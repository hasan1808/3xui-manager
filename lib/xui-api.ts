import { Panel, ServerStatus, Inbound, XUIClient } from "./types";
import { readSettings } from "./settings-store";

class XuiApiClient {
  private baseUrl: string;
  private sessionCookie: string | null = null;
  private apiToken: string | null = null;
  private loggedIn = false;
  private timeout: number;
  private retries: number;

  constructor(panel: Panel) {
    this.baseUrl = panel.url.replace(/\/+$/, "");
    this.apiToken = panel.apiToken || null;
    const settings = readSettings();
    this.timeout = (settings.panelTimeout || 10) * 1000;
    this.retries = settings.panelRetryAttempts || 3;
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<any> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (this.apiToken) {
      headers["Authorization"] = `Bearer ${this.apiToken}`;
    }
    if (this.sessionCookie) {
      headers["Cookie"] = this.sessionCookie;
    }
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.timeout),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
        }
        const cookies = res.headers.get("set-cookie");
        if (cookies) {
          this.sessionCookie = cookies;
          this.loggedIn = true;
        }
        return res.json();
      } catch (e: any) {
        lastError = e;
        if (attempt < this.retries && !options.method) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  async ensureLogin(username: string, password: string): Promise<void> {
    if (this.apiToken || this.loggedIn) return;
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Login failed (${res.status})`);
    const cookies = res.headers.get("set-cookie");
    if (cookies) {
      this.sessionCookie = cookies;
      this.loggedIn = true;
    }
  }

  async getStatus(): Promise<ServerStatus> {
    const data = await this.request("/panel/api/server/status");
    return data.obj || data;
  }

  async getInbounds(): Promise<Inbound[]> {
    const data = await this.request("/panel/api/inbounds/list");
    return data.obj || data || [];
  }

  async getOnlineClients(): Promise<string[]> {
    const data = await this.request("/panel/api/inbounds/onlines");
    return data.obj || [];
  }

  async getClientLinks(inboundId: number, email: string): Promise<string> {
    const data = await this.request(`/panel/api/inbounds/getClientLinks/${inboundId}/${encodeURIComponent(email)}`);
    return data.obj || "";
  }

  async getSubLinks(subId: string): Promise<string[]> {
    const data = await this.request(`/panel/api/inbounds/getSubLinks/${encodeURIComponent(subId)}`);
    return data.obj || [];
  }

  async getSettingAll(): Promise<any> {
    const data = await this.request("/panel/api/setting/all");
    return data.obj || {};
  }

  async proxyGet(path: string): Promise<any> {
    return this.request(path);
  }

  async proxyPost(path: string, body?: any): Promise<any> {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiToken) headers["Authorization"] = `Bearer ${this.apiToken}`;
    if (this.sessionCookie) headers["Cookie"] = this.sessionCookie;
    return headers;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

let clientCache = new Map<string, XuiApiClient>();

export function getXuiClient(panel: Panel): XuiApiClient {
  const key = panel.id;
  const existing = clientCache.get(key);
  if (existing) return existing;
  const client = new XuiApiClient(panel);
  clientCache.set(key, client);
  return client;
}

export function clearClientCache(panelId?: string) {
  if (panelId) clientCache.delete(panelId);
  else clientCache.clear();
}

export async function fetchPanelStatus(panel: Panel): Promise<ServerStatus> {
  const client = getXuiClient(panel);
  await client.ensureLogin(panel.username, panel.password);
  return client.getStatus();
}

export async function fetchPanelInbounds(panel: Panel): Promise<Inbound[]> {
  const client = getXuiClient(panel);
  await client.ensureLogin(panel.username, panel.password);
  return client.getInbounds();
}

export async function proxyPanelRequest(
  panel: Panel,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const client = getXuiClient(panel);
  await client.ensureLogin(panel.username, panel.password);
  if (method === "GET") return client.proxyGet(path);
  return client.proxyPost(path, body);
}
