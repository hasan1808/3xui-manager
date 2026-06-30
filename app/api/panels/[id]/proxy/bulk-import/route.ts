import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getXuiClient } from "@/lib/xui-api";
import { getPanel } from "@/lib/panel-store";
import { getAssignedInbounds } from "@/lib/inbound-ownership-store";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const { inboundId, clients: rawClients, format } = body || {};
  if (!inboundId || !rawClients) {
    return NextResponse.json({ error: "inboundId and clients required" }, { status: 400 });
  }
  if (user && user.role !== "superadmin" && panel.ownerId !== user.userId) {
    const assigned = getAssignedInbounds(id, user.userId);
    if (!assigned.includes(inboundId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let clients: { email: string; totalGB?: number; expiryTime?: number; ipLimit?: number; enable?: boolean; flow?: string }[];
  if (format === "csv") {
    clients = rawClients.split("\n").filter((l: string) => l.trim()).map((line: string) => {
      const parts = line.split(",").map((s: string) => s.trim());
      const email = parts[0];
      const totalGB = parts[1] ? parseFloat(parts[1]) : undefined;
      const expiryDays = parts[2] ? parseInt(parts[2]) : undefined;
      const ipLimit = parts[3] ? parseInt(parts[3]) : undefined;
      const enable = parts[4] ? parts[4] !== "0" : true;
      const flow = parts[5] || undefined;
      return {
        email,
        totalGB: totalGB ? totalGB * 1024 * 1024 * 1024 : 0,
        expiryTime: expiryDays ? Date.now() + expiryDays * 86400000 : 0,
        ipLimit: ipLimit || 0,
        enable,
        flow,
      };
    });
  } else {
    clients = rawClients.map((c: any) => ({
      email: c.email,
      totalGB: c.totalGB || 0,
      expiryTime: c.expiryTime || 0,
      ipLimit: c.ipLimit || 0,
      enable: c.enable !== false,
      flow: c.flow || undefined,
    }));
  }

  try {
    const xui = getXuiClient(panel);
    await xui.ensureLogin(panel.username, panel.password);
    const inbounds: any[] = await xui.getInbounds();
    const inbound = inbounds.find((i: any) => i.id === inboundId);
    if (!inbound) return NextResponse.json({ error: "Inbound not found" }, { status: 404 });

    let settings: any;
    try { settings = typeof inbound.settings === "string" ? JSON.parse(inbound.settings) : inbound.settings; } catch { settings = { clients: [] }; }

    const existingEmails = new Set((settings.clients || []).map((c: any) => c.email));
    const added: string[] = [];
    const skipped: string[] = [];

    for (const c of clients) {
      if (existingEmails.has(c.email)) {
        skipped.push(c.email);
        continue;
      }
      settings.clients.push({
        id: crypto.randomUUID(),
        email: c.email,
        enable: c.enable,
        expiryTime: c.expiryTime,
        totalGB: c.totalGB,
        up: 0,
        down: 0,
        ipLimit: c.ipLimit,
        ...(c.flow ? { flow: c.flow } : {}),
        subId: crypto.randomUUID(),
      });
      existingEmails.add(c.email);
      added.push(c.email);
    }

    await xui.proxyPost(`/panel/api/inbounds/update/${inbound.id}`, { ...inbound, settings: JSON.stringify(settings) });

    return NextResponse.json({ ok: true, added, skipped, total: clients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "خطا" }, { status: 500 });
  }
}
