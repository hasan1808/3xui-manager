"use client";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/lib/toast-context";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { useConfirm } from "@/lib/confirm-dialog";
import FocusTrap from "@/lib/focus-trap";
import { formatBytes, formatSpeed, formatUptime, extractHost } from "@/lib/utils";
import NavBar from "@/lib/navbar";
import { Spinner, SkeletonTable } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import QRCode from "qrcode";

interface Client {
  id: string;
  email: string;
  enable: boolean;
  expiryTime: number;
  totalGB: number;
  up: number;
  down: number;
  ipLimit: number;
  flow?: string;
  subId?: string;
}

interface Inbound {
  id: number;
  port: number | string;
  protocol: string;
  remark: string;
  clients: Client[];
  up: number;
  down: number;
  total: number;
  enable: boolean;
  settings: string;
  streamSettings: string;
}

type FilterMode = "all" | "active" | "inactive" | "expired" | "expiring";
type SortField = "email" | "up" | "down" | "total" | "expiryTime" | "ipLimit";
type SortDir = "asc" | "desc";

function parseClients(inb: any): Client[] {
  try {
    const s = typeof inb.settings === "string" ? JSON.parse(inb.settings) : inb.settings;
    return s?.clients || [];
  } catch { return []; }
}

function modifyClients(inb: any, fn: (clients: Client[]) => Client[]): string {
  const s = typeof inb.settings === "string" ? JSON.parse(inb.settings) : { clients: [] };
  s.clients = fn(s.clients || []);
  return JSON.stringify(s);
}

function genSubUrl(client: Client, subUri: string): string {
  return `${subUri.replace(/\/+$/, "")}/${client.subId || client.id}`;
}

function getPort(port: number | string): number {
  const s = String(port);
  return parseInt(s.split(",")[0].split(":")[0]) || 0;
}

function generateConfig(inb: Inbound, cl: Client, host: string): string {
  const remark = encodeURIComponent(inb.remark);
  const port = getPort(inb.port);
  const ss = (() => { try { return JSON.parse(inb.streamSettings); } catch { return {}; } })();
  const inbSettings = (() => { try { return JSON.parse(inb.settings); } catch { return {}; } })();
  const net = ss.network || "tcp";
  const security = ss.security || "none";

  const reality = ss.realitySettings || {};
  const tls = ss.tlsSettings || {};
  const ws = ss.wsSettings || {};
  const grpc = ss.grpcSettings || {};

  const sni = reality.serverNames?.[0] || tls.serverName || "";
  const fp = reality.fingerprint || (security === "reality" ? "chrome" : "");
  const pbk = reality.publicKey || "";
  const sid = reality.shortIds?.[0] || "";
  const alpn = tls.alpn?.join(",") || "";
  const flow = cl.flow || inbSettings.flow || "";

  switch (inb.protocol) {
    case "vless": {
      const p: Record<string, string> = { type: net, encryption: "none" };
      if (security !== "none") p.security = security;
      if (sni) p.sni = sni;
      if (security === "reality") {
        if (fp) p.fp = fp;
        if (pbk) p.pbk = pbk;
        if (sid) p.sid = sid;
        p.spx = "/";
        if (flow) p.flow = flow;
      }
      if (security === "tls") {
        if (fp) p.fp = fp;
        if (alpn) p.alpn = alpn;
      }
      if (net === "ws") {
        if (ws.path) p.path = ws.path;
        const wsHost = ws.headers?.Host || ws.headers?.host || "";
        if (wsHost) p.host = wsHost;
      }
      if (net === "grpc") {
        if (grpc.serviceName) p.serviceName = grpc.serviceName;
      }
      const qs = new URLSearchParams(p).toString();
      return `vless://${cl.id}@${host}:${port}?${qs}#${remark}`;
    }
    case "vmess": {
      const obj: Record<string, any> = {
        v: "2", ps: inb.remark, add: host, port,
        id: cl.id, aid: "0", scy: "auto",
        net, type: net === "ws" ? "ws" : "none",
        tls: security !== "none" ? security : "", sni, fp, alpn: tls.alpn || [],
      };
      if (net === "ws" && ws.path) obj.path = ws.path;
      if (net === "grpc" && grpc.serviceName) obj.path = grpc.serviceName;
      return "vmess://" + btoa(JSON.stringify(obj));
    }
    case "trojan": {
      const p: Record<string, string> = { type: net, security: "tls" };
      if (sni) p.sni = sni;
      if (fp) p.fp = fp;
      if (alpn) p.alpn = alpn;
      if (net === "ws") {
        if (ws.path) p.path = ws.path;
        const wsHost = ws.headers?.Host || ws.headers?.host || "";
        if (wsHost) p.host = wsHost;
      }
      if (net === "grpc") {
        if (grpc.serviceName) p.serviceName = grpc.serviceName;
      }
      const qs = new URLSearchParams(p).toString();
      return `trojan://${cl.id}@${host}:${port}?${qs}#${remark}`;
    }
    case "shadowsocks": {
      const method = inbSettings.method || "aes-256-gcm";
      const password = inbSettings.password || cl.id;
      const encoded = btoa(`${method}:${password}@${host}:${port}`);
      return `ss://${encoded}#${remark}`;
    }
    default: return "";
  }
}

async function logAction(action: string, detail: string) {
  await fetch("/api/logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, detail }) }).catch(() => {});
}

function SortIcon({ field, currentField, dir }: { field: SortField; currentField: SortField; dir: SortDir }) {
  if (currentField !== field) return <span className="text-gray-600 ml-1">↕</span>;
  return <span className="text-blue-400 ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

function MobileActions({ inb, cl, busy, actionLoading, onToggle, onEdit, onDelete, onReset, onConfig, onSub, onTraffic }: {
  inb: Inbound; cl: Client; busy: boolean; actionLoading: Record<string, boolean>;
  onToggle: (inb: Inbound, cl: Client) => void;
  onEdit: (inb: Inbound, cl: Client) => void;
  onDelete: (inb: Inbound, cl: Client) => void;
  onReset: (inb: Inbound, cl: Client) => void;
  onConfig: (inb: Inbound, cl: Client) => void;
  onSub: (cl: Client) => void;
  onTraffic: (inb: Inbound, cl: Client) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const actions = [
    { label: cl.enable ? "غیرفعال" : "فعال", color: cl.enable ? "bg-yellow-600" : "bg-green-600", action: () => onToggle(inb, cl) },
    { label: "ویرایش", color: "bg-gray-600", action: () => onEdit(inb, cl) },
    { label: "ریست ترافیک", color: "bg-purple-600", action: () => onReset(inb, cl) },
    { label: "لینک", color: "bg-teal-600", action: () => onConfig(inb, cl) },
    { label: "ساب", color: "bg-cyan-600", action: () => onSub(cl) },
    { label: "ترافیک", color: "bg-orange-600", action: () => onTraffic(inb, cl) },
    { label: "حذف", color: "bg-red-700", action: () => onDelete(inb, cl) },
  ];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="px-2 py-1 rounded text-xs bg-gray-600 hover:bg-gray-700 transition">عملیات ▾</button>
      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-lg shadow-lg py-1 z-50 min-w-32 max-h-80 overflow-y-auto"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          {actions.map((a) => (
            <button key={a.label} onClick={() => { setOpen(false); if (!busy) a.action(); }}
              className={`block w-full text-right px-3 py-1.5 text-xs text-white ${a.color} hover:opacity-80 transition`}>
              {actionLoading[`toggle-cl-${cl.id}`] && a.label === (cl.enable ? "غیرفعال" : "فعال") ? <Spinner /> : a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PanelDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [panel, setPanel] = useState<any>(null);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ inb: Inbound; client?: Client } | null>(null);
  const [form, setForm] = useState({ email: "", totalGB: "", expiryTime: "", ipLimit: "0", enable: true });
  const [search, setSearch] = useState("");
  const [searchInb, setSearchInb] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [subUri, setSubUri] = useState("");
  const [previewLink, setPreviewLink] = useState("");
  const [previewTitle, setPreviewTitle] = useState("لینک کانفیگ");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortField, setSortField] = useState<SortField>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showInbForm, setShowInbForm] = useState(false);
  const [inbForm, setInbForm] = useState({ protocol: "vless", port: "", remark: "", streamSettings: "{}" });
  const [trafficModal, setTrafficModal] = useState<{ inb: Inbound; client: Client } | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<{ time: string; up: number; down: number }[]>([]);
  const trafficPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [expandedInbounds, setExpandedInbounds] = useState<Set<number>>(new Set());
  const [inboundPages, setInboundPages] = useState<Record<number, number>>({});
  const [clientLinksMap, setClientLinksMap] = useState<Record<string, string>>({});
  const [subUrlsMap, setSubUrlsMap] = useState<Record<string, string>>({});
  const linksSyncing = useRef(false);

  const host = panel?.url ? extractHost(panel.url) : "";

  useKeyboardShortcuts({
    "Ctrl+f": () => searchRef.current?.focus(),
    "Escape": () => { setModal(null); setPreviewLink(""); setQrDataUrl(""); setShowInbForm(false); setTrafficModal(null); },
  });

  async function fetchData(signal?: AbortSignal) {
    const pres = await fetch(`/api/panels/${id}`, { signal });
    if (!pres.ok) return router.push("/panels");
    const p = await pres.json();
    setPanel(p);
    if (p.subUri) setSubUri(p.subUri);
    const [ires, sres] = await Promise.all([
      fetch(`/api/panels/${id}/proxy/panel/api/inbounds/list`, { signal }),
      fetch(`/api/panels/${id}/status`, { signal }),
    ]);
    if (ires.ok) {
      const data = await ires.json();
      const inbList = (data.obj || []).map((inb: any) => ({ ...inb, clients: parseClients(inb) }));
      const trafficResults = await Promise.allSettled(
        inbList.flatMap((inb: any) =>
          inb.clients.map(async (cl: any) => {
            const tres = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/getClientTraffics/${encodeURIComponent(cl.email)}`, { signal }).catch(() => null);
            if (tres?.ok) {
              const td = await tres.json();
              const t = td.obj;
              if (t) {
                cl.up = t.up || 0;
                cl.down = t.down || 0;
              }
            }
          })
        )
      );
      setInbounds(inbList);
    }
    const cpuRes = await fetch(`/api/panels/${id}/proxy/panel/api/server/cpuHistory/60`, { signal }).catch(() => null);
    if (cpuRes?.ok) { const d = await cpuRes.json(); setCpuHistory((d.obj || []).map((v: any) => v.cpu)); }
    const ores = await fetch(`/api/panels/${id}/onlines`, { signal }).catch(() => null);
    if (ores?.ok) { const odata = await ores.json(); setOnlineCount(odata.count || 0); }
    setLoading(false);
    loadLinks();
    syncLinks();
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    return () => { if (trafficPoll.current) clearInterval(trafficPoll.current); };
  }, []);

  function formatPercent(current: number, total: number): number { return total ? Math.round((current / total) * 100) : 0; }
  function tsToDays(ts: number): string { if (!ts) return ""; const d = ts - Date.now(); return d <= 0 ? "0" : String(Math.ceil(d / 86400000)); }
  function daysToTs(days: string): number { if (!days) return 0; const n = parseInt(days); return n > 0 ? Date.now() + n * 86400000 : 0; }
  function formatExpiry(ts: number): string { if (!ts || ts === 0) return "نامحدود"; return new Date(ts).toLocaleDateString("fa-IR"); }

  function toggleInboundExpand(id: number) {
    setExpandedInbounds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function withLoading(key: string, fn: () => Promise<any>) {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try { await fn(); } catch (e: any) { toast(e?.message || "خطا", "error"); } finally { setActionLoading((prev) => ({ ...prev, [key]: false })); }
  }

  async function updateInbound(inb: Inbound, newSettings: string, overrides: Record<string, any> = {}) {
    const raw = inb as any;
    const payload: Record<string, any> = {
      id: inb.id,
      settings: newSettings,
      streamSettings: raw.streamSettings || "{}",
      sniffing: raw.sniffing || "",
      tag: raw.tag || "",
      remark: inb.remark,
      enable: inb.enable,
      port: inb.port,
      protocol: inb.protocol,
      listen: raw.listen || "",
      total: inb.total || 0,
      up: inb.up || 0,
      down: inb.down || 0,
    };
    Object.assign(payload, overrides);
    const res = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/update/${inb.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.msg || data?.error || `خطا (${res.status})`);
    if (data.success === false) throw new Error(data?.msg || "خطا در ذخیره");
  }

  async function toggleInbound(inb: Inbound) {
    await withLoading(`toggle-inb-${inb.id}`, async () => {
      const newEnable = !inb.enable;
      await updateInbound(inb, inb.settings, { enable: newEnable });
      setInbounds((prev) => prev.map((x) => (x.id === inb.id ? { ...x, enable: newEnable } : x)));
      logAction("toggle_inbound", `${inb.remark} -> ${newEnable ? "فعال" : "غیرفعال"}`);
      toast(newEnable ? "فعال شد" : "غیرفعال شد");
    });
  }

  async function toggleClient(inb: Inbound, client: Client) {
    await withLoading(`toggle-cl-${client.id}`, async () => {
      const newEnable = !client.enable;
      const ns = modifyClients(inb, (cs) => cs.map((c) => c.id === client.id ? { ...c, enable: newEnable } : c));
      await updateInbound(inb, ns);
      setInbounds((prev) => prev.map((x) => x.id === inb.id ? { ...x, clients: x.clients.map((c) => c.id === client.id ? { ...c, enable: newEnable } : c), settings: ns } : x));
      logAction("toggle_client", `${client.email} -> ${newEnable ? "فعال" : "غیرفعال"}`);
      toast(newEnable ? "فعال شد" : "غیرفعال شد");
    });
  }

  async function batchToggle(inb: Inbound, enable: boolean) {
    if (selected.size === 0) { toast("کاربری انتخاب نشده", "error"); return; }
    const selectedIds = new Set(selected);
    await withLoading(`batch-${inb.id}`, async () => {
      const ns = modifyClients(inb, (cs) => cs.map((c) => selectedIds.has(c.id) ? { ...c, enable } : c));
      await updateInbound(inb, ns);
      setInbounds((prev) => prev.map((x) => x.id === inb.id ? { ...x, clients: x.clients.map((c) => selectedIds.has(c.id) ? { ...c, enable } : c), settings: ns } : x));
      logAction("batch_toggle", `${selectedIds.size} کاربر در ${inb.remark} -> ${enable ? "فعال" : "غیرفعال"}`);
      setSelected(new Set());
      toast(`${selectedIds.size} کاربر ${enable ? "فعال" : "غیرفعال"} شدند`);
      syncLinks();
    });
  }

  async function deleteClient(inb: Inbound, client: Client) {
    const ok = await confirm({ title: "حذف کاربر", message: `${client.email} حذف شود؟`, variant: "danger" });
    if (!ok) return;
    await withLoading(`del-${client.id}`, async () => {
      const ns = modifyClients(inb, (cs) => cs.filter((c) => c.id !== client.id));
      await updateInbound(inb, ns);
      setInbounds((prev) => prev.map((x) => x.id === inb.id ? { ...x, clients: x.clients.filter((c) => c.id !== client.id), settings: ns } : x));
      logAction("delete_client", `${client.email} از ${inb.remark}`);
      toast("حذف شد");
      syncLinks();
    });
  }

  function openAdd(inb: Inbound) { setForm({ email: "", totalGB: "", expiryTime: "", ipLimit: "0", enable: true }); setModal({ inb }); }
  function openEdit(inb: Inbound, client: Client) {
    setForm({ email: client.email, totalGB: client.totalGB > 0 ? String(client.totalGB) : "", expiryTime: tsToDays(client.expiryTime), ipLimit: String(client.ipLimit || 0), enable: client.enable });
    setModal({ inb, client });
  }

  async function saveClient() {
    if (!modal) return;
    const { inb, client } = modal;
    if (!form.email.trim()) { toast("ایمیل را وارد کنید", "error"); return; }
    const totalGB = form.totalGB ? parseFloat(form.totalGB) * 1024 * 1024 * 1024 : 0;
    const expiryTime = daysToTs(form.expiryTime);
    const ipLimit = parseInt(form.ipLimit) || 0;
    await withLoading(`save-${client?.id || "new"}`, async () => {
      const ns = modifyClients(inb, (cs) => {
        if (client) return cs.map((c) => c.id === client.id ? { ...c, email: form.email.trim(), totalGB, expiryTime, ipLimit, enable: form.enable } : c);
        return [...cs, { id: crypto.randomUUID(), email: form.email.trim(), enable: form.enable, expiryTime, totalGB, up: 0, down: 0, ipLimit, subId: crypto.randomUUID() }];
      });
      await updateInbound(inb, ns);
      setInbounds((prev) => prev.map((x) => x.id === inb.id ? { ...x, clients: parseClients({ ...x, settings: ns }), settings: ns } : x));
      logAction(client ? "edit_client" : "add_client", `${form.email.trim()} در ${inb.remark}`);
      setModal(null);
      toast(client ? "ویرایش شد" : "افزوده شد");
      syncLinks();
    });
  }

  async function resetTraffic(inb: Inbound, client: Client) {
    const ok = await confirm({ title: "ریست ترافیک", message: `آمار ترافیک ${client.email} ریست شود؟`, variant: "danger" });
    if (!ok) return;
    await withLoading(`reset-${client.id}`, async () => {
      const res = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/${inb.id}/resetClientTraffic/${encodeURIComponent(client.email)}`, { method: "POST" });
      if (!res.ok) { toast("خطا در ریست", "error"); return; }
      logAction("reset_traffic", `${client.email} در ${inb.remark}`);
      toast("ریست شد");
      try {
        const tres = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/getClientTraffics/${encodeURIComponent(client.email)}`);
        if (tres.ok) { const td = await tres.json(); const t = td.obj; if (t) { setInbounds((prev) => prev.map((x) => x.id === inb.id ? { ...x, clients: x.clients.map((c) => c.email === client.email ? { ...c, up: t.up || 0, down: t.down || 0 } : c) } : x)); } }
      } catch {}
    });
  }

  async function syncLinks() {
    if (linksSyncing.current) return;
    linksSyncing.current = true;
    try {
      await fetch(`/api/panels/${id}/links`, { method: "POST" });
      await loadLinks();
    } catch {}
    linksSyncing.current = false;
  }

  async function loadLinks() {
    try {
      const res = await fetch(`/api/panels/${id}/links`);
      if (res.ok) {
        const data = await res.json();
        const cmap: Record<string, string> = {};
        for (const l of data.links || []) {
          const key = `${l.inboundId}:${l.email}`;
          if (l.configLink) cmap[key] = l.configLink;
        }
        setClientLinksMap(cmap);
        setSubUrlsMap(data.subUrls || {});
      }
    } catch {}
  }

  async function showConfig(inb: Inbound, client: Client) {
    setPreviewTitle("لینک کانفیگ");
    setPreviewLink("در حال دریافت لینک...");
    setQrDataUrl("");
    try {
      const res = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/getClientLinks/${inb.id}/${encodeURIComponent(client.email)}`);
      if (res.ok) {
        const data = await res.json();
        const link = data.obj || "";
        if (link) {
          setPreviewLink(link);
          try { setQrDataUrl(await QRCode.toDataURL(link, { width: 256, margin: 2 })); } catch {}
          return;
        }
      }
    } catch {}
    const link = generateConfig(inb, client, host);
    setPreviewLink(link);
    try { setQrDataUrl(await QRCode.toDataURL(link, { width: 256, margin: 2 })); } catch {}
  }

  async function copyText(text: string) { await navigator.clipboard.writeText(text); toast("کپی شد"); }
  async function showSub(client: Client) {
    const subId = client.subId || client.id;
    let s = "";
    if (subUri) {
      s = `${subUri.replace(/\/+$/, "")}/${subId}`;
    } else {
      try {
        const settingsRes = await fetch(`/api/panels/${id}/settings`);
        if (settingsRes.ok) {
          const sd = await settingsRes.json();
          const st = sd.obj || {};
          const subUriVal = st.SubURI || st.subUri || st.SubUri;
          const subPathVal = st.SubPath || st.subPath;
          const subPortVal = st.SubPort || st.subPort || 2096;
          if (subUriVal) { s = `${subUriVal.replace(/\/+$/, "")}/${subId}`; }
          else if (subPathVal) {
            const h = extractHost(panel?.url || "");
            if (h) s = `${panel?.url?.startsWith("https") ? "https" : "http"}://${h}:${subPortVal}${subPathVal}${subId}`;
          }
        }
      } catch {}
    }
    if (!s) { const h = extractHost(panel?.url || ""); if (h) s = `https://${h}:2096/sub/${subId}`; }
    if (!s) { toast("ساب ساخته نشد", "error"); return; }
    setPreviewTitle("سابسکریپشن");
    setPreviewLink(s);
    try { setQrDataUrl(await QRCode.toDataURL(s, { width: 256, margin: 2 })); } catch {}
  }

  async function showTraffic(inb: Inbound, client: Client) {
    setTrafficModal({ inb, client });
    setTrafficHistory([{ time: new Date().toLocaleTimeString("fa-IR"), up: client.up, down: client.down }]);
    if (trafficPoll.current) clearInterval(trafficPoll.current);
    trafficPoll.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/list`);
        if (res.ok) {
          const data = await res.json();
          const list = data.obj || [];
          for (const inbItem of list) {
            if (inbItem.id === inb.id) {
              const clients = parseClients(inbItem);
              const found = clients.find((c: Client) => c.id === client.id);
              if (found) {
                setTrafficHistory((prev) => {
                  const next = [...prev, { time: new Date().toLocaleTimeString("fa-IR"), up: found.up, down: found.down }];
                  return next.slice(-30);
                });
              }
            }
          }
        }
      } catch {}
    }, 5000);
  }

  function closeTrafficModal() {
    setTrafficModal(null);
    if (trafficPoll.current) { clearInterval(trafficPoll.current); trafficPoll.current = null; }
  }

  async function createInbound() {
    if (!inbForm.port || !inbForm.remark) { toast("پورت و نام وارد کنید", "error"); return; }
    await withLoading("create-inb", async () => {
      const payload = {
        port: parseInt(inbForm.port),
        protocol: inbForm.protocol,
        remark: inbForm.remark,
        enable: true, total: 0,
        settings: JSON.stringify({ clients: [], decryption: "none", fallbacks: [] }),
        streamSettings: inbForm.streamSettings,
      };
      const res = await fetch(`/api/panels/${id}/proxy/panel/api/inbounds/add`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { toast("خطا در ایجاد", "error"); return; }
      logAction("create_inbound", `${inbForm.remark} (${inbForm.protocol}:${inbForm.port})`);
      toast("اینباند ساخته شد");
      setShowInbForm(false);
      setInbForm({ protocol: "vless", port: "", remark: "", streamSettings: "{}" });
      fetchData();
    });
  }

  function toggleSelect(clientId: string) { setSelected((p) => { const n = new Set(p); if (n.has(clientId)) n.delete(clientId); else n.add(clientId); return n; }); }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
    setInboundPages({});
  }

  const filteredClients = useMemo(() => {
    const now = Date.now();
    const threeDays = 3 * 86400000;
    return inbounds.map((inb) => ({
      ...inb,
      clients: inb.clients
        .filter((c) => {
          if (search && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
          if (filter === "active") return c.enable;
          if (filter === "inactive") return !c.enable;
          if (filter === "expired") return c.expiryTime > 0 && c.expiryTime <= now;
          if (filter === "expiring") return c.expiryTime > 0 && c.expiryTime <= now + threeDays && c.expiryTime > now;
          return true;
        })
        .sort((a, b) => {
          const dir = sortDir === "asc" ? 1 : -1;
          if (sortField === "email") return a.email.localeCompare(b.email) * dir;
          if (sortField === "total") return ((a.up + a.down || 0) - (b.up + b.down || 0)) * dir;
          const va = a[sortField], vb = b[sortField];
          return ((va || 0) - (vb || 0)) * dir;
        }),
    }));
  }, [inbounds, search, filter, sortField, sortDir]);

  const visibleInbounds = useMemo(() => {
    return filteredClients
      .filter((inb) => !searchInb || inb.remark.toLowerCase().includes(searchInb.toLowerCase()))
      .filter((inb) => !search || inb.clients.length > 0);
  }, [filteredClients, searchInb, search]);

  const searchInputs = (
    <div className="flex items-center gap-2">
      <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
        className="rounded px-3 py-1.5 text-sm w-20 sm:w-28 outline-none border transition-shadow duration-200 focus:ring-2 focus:ring-blue-500" dir="ltr"
        placeholder="Ctrl+F جستجو"
        style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
      <input value={searchInb} onChange={(e) => { setSearchInb(e.target.value); setInboundPages({}); }}
        className="rounded px-3 py-1.5 text-sm w-20 sm:w-28 outline-none border transition-shadow duration-200 focus:ring-2 focus:ring-blue-500" placeholder="اینباند"
        style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title={panel?.name || "..."} search={searchInputs} backTo="/panels" />

      <div className="p-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <Spinner />
            <p className="text-gray-400 mt-2 text-sm">در حال بارگذاری...</p>
          </div>
        ) : (
          <PageTransition>
          <>
            {status && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6 text-sm">
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">CPU</p>
                  <p className="text-lg font-bold">{status.cpu?.toFixed(1) || "-"}%</p>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">RAM</p>
                  <p className="text-lg font-bold">{formatPercent(status.mem?.current, status.mem?.total)}%</p>
                  <p className="text-gray-500 text-xs">{formatBytes(status.mem?.current)} / {formatBytes(status.mem?.total)}</p>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">Disk</p>
                  <p className="text-lg font-bold">{formatPercent(status.disk?.current, status.disk?.total)}%</p>
                  <p className="text-gray-500 text-xs">{formatBytes(status.disk?.current)} / {formatBytes(status.disk?.total)}</p>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">Uptime</p>
                  <p className="text-lg font-bold">{formatUptime(status.uptime)}</p>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">Speed</p>
                  <p className="text-green-400 font-medium">↑{formatSpeed(status.netIO?.up)}</p>
                  <p className="text-blue-400 font-medium">↓{formatSpeed(status.netIO?.down)}</p>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">CPU (60m)</p>
                  <div className="flex items-end gap-0.5 h-10 justify-center" dir="ltr">
                    {cpuHistory.slice(-20).map((v, i) => (
                      <div key={i} className="w-2 rounded-t" style={{ height: `${Math.min(v, 100)}%`, backgroundColor: v > 80 ? "#ef4444" : v > 50 ? "#eab308" : "#22c55e" }} />
                    ))}
                    {cpuHistory.length === 0 && <span className="text-gray-500 text-xs">-</span>}
                  </div>
                </div>
                <div className="rounded-lg p-4 text-center transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-gray-400 text-xs">آنلاین</p>
                  <p className="text-lg font-bold text-green-400">{onlineCount}</p>
                  <p className="text-gray-500 text-xs">کاربر</p>
                </div>
              </div>
            )}

            <div className="rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-2 shadow text-sm" style={{ background: "var(--bg-secondary)" }}>
              <span className="text-gray-400 truncate min-w-0 max-w-full" dir="ltr">{panel?.url}</span>
              <span className="text-gray-500 text-xs whitespace-nowrap">{status?.version ? `Panel v${status.version}` : ""}</span>
              <div className="flex gap-2 shrink-0">
                <button onClick={syncLinks} className="bg-gray-600 hover:bg-gray-700 px-3 py-1.5 rounded transition text-sm">
                  بروزرسانی لینک‌ها
                </button>
                <button onClick={() => setShowInbForm(!showInbForm)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition text-sm">
                  {showInbForm ? "انصراف" : "+ اینباند"}
                </button>
              </div>
            </div>

            {showInbForm && (
              <div className="rounded-lg p-6 mb-6 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
                <h3 className="font-semibold">ایجاد اینباند جدید</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400">پروتکل</label>
                    <select value={inbForm.protocol} onChange={(e) => setInbForm({ ...inbForm, protocol: e.target.value })}
                      className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                      <option value="vless">VLESS</option>
                      <option value="vmess">VMess</option>
                      <option value="trojan">Trojan</option>
                      <option value="shadowsocks">Shadowsocks</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">پورت</label>
                    <input type="number" value={inbForm.port} onChange={(e) => setInbForm({ ...inbForm, port: e.target.value })}
                      className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">نام (remark)</label>
                  <input value={inbForm.remark} onChange={(e) => setInbForm({ ...inbForm, remark: e.target.value })}
                    className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Stream Settings (JSON)</label>
                  <textarea value={inbForm.streamSettings} onChange={(e) => setInbForm({ ...inbForm, streamSettings: e.target.value })}
                    className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none font-mono" rows={4} dir="ltr"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                </div>
                <button onClick={createInbound} disabled={actionLoading["create-inb"]}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded text-sm transition">
                  {actionLoading["create-inb"] ? <><Spinner /> ایجاد...</> : "ایجاد اینباند"}
                </button>
              </div>
            )}

            {visibleInbounds.length === 0 ? (
              <div className="text-center py-16" style={{ color: "var(--text-secondary)" }}>
                <div className="text-4xl mb-3 text-gray-600">{inbounds.length === 0 ? "📦" : "🔍"}</div>
                <p className="text-lg font-medium mb-1">{inbounds.length === 0 ? "هیچ اینباندی وجود ندارد" : search ? "نتیجه‌ای برای جستجوی شما یافت نشد" : "اینباند خالی است"}</p>
                <p className="text-sm mb-4">{inbounds.length === 0 ? "برای شروع یک اینباند جدید بسازید" : search ? "عبارت جستجو را تغییر دهید" : "برای این اینباند کاربری تعریف نشده"}</p>
                {inbounds.length === 0 && (
                  <button onClick={() => setShowInbForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm">
                    + ایجاد اینباند
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleInbounds.map((inb) => {
                  const pageSize = 20;
                  const inbPage = inboundPages[inb.id] || 0;
                  const totalPages = Math.ceil(inb.clients.length / pageSize);
                  const paged = inb.clients.slice(inbPage * pageSize, (inbPage + 1) * pageSize);
                  const isExpanded = expandedInbounds.has(inb.id);
                  return (
                    <div key={inb.id} className="rounded-lg shadow overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                      <div className="p-4 flex flex-wrap items-center justify-between gap-2" style={{ borderBottom: isExpanded ? "1px solid var(--border-color)" : "none" }}>
                        <div className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0" onClick={() => toggleInboundExpand(inb.id)}>
                          <span className={`text-lg transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} style={{ color: "var(--text-secondary)" }}>▶</span>
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${inb.enable ? "bg-green-500" : "bg-red-500"}`} />
                          <div className="min-w-0">
                            <h2 className="font-medium truncate">{inb.remark}</h2>
                            <p className="text-gray-400 text-sm">{inb.protocol} | پورت {inb.port} | {inb.clients.length} کاربر</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left text-sm">
                            <p>↑{formatBytes(inb.up)}</p>
                            <p>↓{formatBytes(inb.down)}</p>
                            {inb.total > 0 && <p className="text-gray-500">حد {formatBytes(inb.total)}</p>}
                          </div>
                          {selected.size > 0 && (
                            <div className="flex gap-1">
                              <button onClick={() => batchToggle(inb, true)} className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs transition">فعال دسته‌ای</button>
                              <button onClick={() => batchToggle(inb, false)} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs transition">غیرفعال دسته‌ای</button>
                            </div>
                          )}
                          <button onClick={() => openAdd(inb)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs transition">+ کاربر</button>
                          <button onClick={() => toggleInbound(inb)} className={`px-3 py-1 rounded text-xs transition ${inb.enable ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
                            {actionLoading[`toggle-inb-${inb.id}`] ? <Spinner /> : inb.enable ? "غیرفعال" : "فعال"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (<>
                      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-tertiary)" }}>
                        {(["all", "active", "inactive", "expired", "expiring"] as FilterMode[]).map((f) => (
                          <button key={f} onClick={() => { setFilter(f); setInboundPages({}); }}
                            className={`px-3 py-1 rounded text-xs transition ${filter === f ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                            {f === "all" ? "همه" : f === "active" ? "فعال" : f === "inactive" ? "غیرفعال" : f === "expired" ? "منقضی" : "در حال انقضا"}
                          </button>
                        ))}
                      </div>

                      {paged.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: "var(--bg-tertiary)" }}>
                                <th className="p-3 text-right w-8">
                                  <input type="checkbox" onChange={() => { const all = paged.map((c) => c.id); setSelected((p) => p.size === all.length ? new Set() : new Set(all)); }}
                                    checked={paged.length > 0 && paged.every((c) => selected.has(c.id))} className="rounded" style={{ background: "var(--bg-tertiary)" }} />
                                </th>
                                <th className="p-3 text-right cursor-pointer hover:text-blue-400" onClick={() => handleSort("email")}><SortIcon field="email" currentField={sortField} dir={sortDir} />ایمیل</th>
                                <th className="p-3 text-right cursor-pointer hover:text-blue-400 hidden sm:table-cell" onClick={() => handleSort("up")}><SortIcon field="up" currentField={sortField} dir={sortDir} />آپلود</th>
                                <th className="p-3 text-right cursor-pointer hover:text-blue-400 hidden sm:table-cell" onClick={() => handleSort("down")}><SortIcon field="down" currentField={sortField} dir={sortDir} />دانلود</th>
                                <th className="p-3 text-right cursor-pointer hover:text-blue-400 hidden md:table-cell" onClick={() => handleSort("total")}><SortIcon field="total" currentField={sortField} dir={sortDir} />مجموع</th>
                                <th className="p-3 text-right hidden md:table-cell">باقیمانده</th>
                                <th className="p-3 text-right cursor-pointer hover:text-blue-400 hidden md:table-cell" onClick={() => handleSort("expiryTime")}><SortIcon field="expiryTime" currentField={sortField} dir={sortDir} />انقضا</th>
                                <th className="p-3 text-right">وضعیت</th>
                                <th className="p-3 text-right">عملیات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paged.map((cl) => {
                                const busy = actionLoading[`toggle-cl-${cl.id}`] || actionLoading[`del-${cl.id}`] || actionLoading[`reset-${cl.id}`] || actionLoading[`save-${cl.id}`];
                                const isExpired = cl.expiryTime > 0 && cl.expiryTime <= Date.now();
                                return (
                                  <tr key={cl.id} className="border-t" style={{ borderColor: "var(--border-color)", background: isExpired ? "rgba(220,38,38,0.15)" : undefined }}>
                                    <td className="p-3"><input type="checkbox" checked={selected.has(cl.id)} onChange={() => toggleSelect(cl.id)} className="rounded" style={{ background: "var(--bg-tertiary)" }} /></td>
                                    <td className="p-3">{cl.email}</td>
                                    <td className="p-3 text-gray-400 hidden sm:table-cell">{formatBytes(cl.up)}</td>
                                    <td className="p-3 text-gray-400 hidden sm:table-cell">{formatBytes(cl.down)}</td>
                                    <td className="p-3 text-gray-400 hidden md:table-cell">{formatBytes(cl.up + cl.down)}</td>
                                    <td className="p-3 hidden md:table-cell">
                                      {cl.totalGB > 0 ? (
                                        <span className={cl.totalGB - (cl.up + cl.down) < cl.totalGB * 0.1 ? "text-red-400" : "text-gray-400"}>
                                          {formatBytes(cl.totalGB - (cl.up + cl.down))}
                                        </span>
                                      ) : <span className="text-gray-500">نامحدود</span>}
                                    </td>
                                    <td className="p-3 text-gray-400 hidden md:table-cell">{formatExpiry(cl.expiryTime)}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${cl.enable ? "bg-green-600" : "bg-red-600"}`}>{cl.enable ? "فعال" : "غیرفعال"}</span></td>
                                    <td className="p-3">
                                      <div className="flex flex-wrap gap-1 sm:max-w-[380px]">
                                        <button onClick={() => toggleClient(inb, cl)} disabled={busy}
                                          className={`hidden sm:inline-block px-2 py-1 rounded text-xs disabled:opacity-50 transition ${cl.enable ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}`}>{busy ? <Spinner /> : cl.enable ? "غیرفعال" : "فعال"}</button>
                                        <button onClick={() => openEdit(inb, cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-gray-600 hover:bg-gray-700 disabled:opacity-50 transition">ویرایش</button>
                                        <button onClick={() => resetTraffic(inb, cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition">{actionLoading[`reset-${cl.id}`] ? <Spinner /> : "ریست ترافیک"}</button>
                                        <button onClick={() => showConfig(inb, cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition">لینک</button>
                                        <button onClick={() => showSub(cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 transition">ساب</button>
                                        <button onClick={() => showTraffic(inb, cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-50 transition">ترافیک</button>
                                        <button onClick={() => deleteClient(inb, cl)} disabled={busy}
                                          className="hidden sm:inline-block px-2 py-1 rounded text-xs bg-red-700 hover:bg-red-800 disabled:opacity-50 transition">حذف</button>
                                        <div className="sm:hidden relative">
                                          <MobileActions inb={inb} cl={cl} busy={busy} actionLoading={actionLoading}
                                            onToggle={toggleClient} onEdit={openEdit} onDelete={deleteClient}
                                            onReset={resetTraffic} onConfig={showConfig}
                                            onSub={showSub} onTraffic={showTraffic} />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 p-3 border-t" style={{ borderColor: "var(--border-color)" }}>
                              <button onClick={() => setInboundPages((p) => ({ ...p, [inb.id]: Math.max(0, (p[inb.id] || 0) - 1) }))} disabled={inbPage === 0}
                                className="px-3 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition">قبلی</button>
                              <span className="text-xs text-gray-400">صفحه {inbPage + 1} از {totalPages}</span>
                              <button onClick={() => setInboundPages((p) => ({ ...p, [inb.id]: Math.min(totalPages - 1, (p[inb.id] || 0) + 1) }))} disabled={inbPage >= totalPages - 1}
                                className="px-3 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition">بعدی</button>
                            </div>
                          )}
                        </div>
                      )}
                      </>)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
          </PageTransition>
        )}
      </div>

      {modal && (
        <FocusTrap active={true} onClose={() => setModal(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="rounded-lg p-6 w-full max-w-md mx-4 shadow-xl" style={{ background: "var(--bg-secondary)" }} onClick={(e) => e.stopPropagation()}>
            <h3 id="modal-title" className="text-lg font-semibold mb-4">{modal.client ? "ویرایش کاربر" : "افزودن کاربر"}</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-400">ایمیل</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" required /></div>
              <div><label className="text-xs text-gray-400">حجم (GB) - خالی = نامحدود</label>
                <input type="number" min="0" value={form.totalGB} onChange={(e) => setForm({ ...form, totalGB: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" /></div>
              <div><label className="text-xs text-gray-400">انقضا (روز از الان)</label>
                <input type="number" min="1" value={form.expiryTime} onChange={(e) => setForm({ ...form, expiryTime: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" placeholder="۳۰" /></div>
              <div><label className="text-xs text-gray-400">محدودیت IP (0 = نامحدود)</label>
                <input type="number" min="0" value={form.ipLimit} onChange={(e) => setForm({ ...form, ipLimit: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm mt-1 border outline-none"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.enable} onChange={(e) => setForm({ ...form, enable: e.target.checked })} className="rounded" style={{ background: "var(--bg-tertiary)" }} />
                <label className="text-sm">فعال</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded text-sm transition" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>انصراف</button>
              <button onClick={saveClient} disabled={!form.email} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2.5 rounded text-sm transition">
                {actionLoading[`save-${modal?.client?.id || "new"}`] ? <><Spinner /> ذخیره</> : "ذخیره"}
              </button>
            </div>
          </div>
        </div>
        </FocusTrap>
      )}

      {previewLink && (
        <FocusTrap active={true} onClose={() => { setPreviewLink(""); setQrDataUrl(""); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setPreviewLink(""); setQrDataUrl(""); }}>
          <div className="rounded-lg p-6 w-full max-w-xl mx-4 shadow-xl" style={{ background: "var(--bg-secondary)" }} onClick={(e) => e.stopPropagation()}>
            <h3 id="preview-title" className="text-lg font-semibold mb-4">{previewTitle}</h3>
            <textarea readOnly value={previewLink} className="w-full rounded px-3 py-2 text-sm mt-1 font-mono border outline-none overflow-x-auto"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
              dir="ltr" rows={4} onClick={(e) => e.currentTarget.select()} />
            {qrDataUrl && <div className="flex justify-center mt-4"><img src={qrDataUrl} alt="QR" className="w-48 h-48" /></div>}
            <div className="flex gap-3 mt-4">
              <button onClick={async () => { try { await navigator.clipboard.writeText(previewLink); } catch { const t = document.createElement("textarea"); t.value = previewLink; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); } toast("کپی شد"); }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 rounded text-sm transition">کپی</button>
              <button onClick={() => { setPreviewLink(""); setQrDataUrl(""); }} className="flex-1 py-2.5 rounded text-sm transition" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>بستن</button>
            </div>
          </div>
        </div>
        </FocusTrap>
      )}

      {trafficModal && (
        <FocusTrap active={true} onClose={closeTrafficModal}>
        <div role="dialog" aria-modal="true" aria-labelledby="traffic-title" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={closeTrafficModal}>
          <div className="rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl" style={{ background: "var(--bg-secondary)" }} onClick={(e) => e.stopPropagation()}>
            <h3 id="traffic-title" className="text-lg font-semibold mb-4">تاریخچه ترافیک: {trafficModal.client.email}</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>به‌روزرسانی هر ۵ ثانیه (۳۰ نقطه آخر)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr style={{ background: "var(--bg-tertiary)" }}><th className="p-2 text-right">زمان</th><th className="p-2 text-right">↑ آپلود</th><th className="p-2 text-right">↓ دانلود</th></tr></thead>
                <tbody>
                  {trafficHistory.slice(-15).reverse().map((p, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="p-2">{p.time}</td>
                      <td className="p-2 text-green-400">{formatBytes(p.up)}</td>
                      <td className="p-2 text-blue-400">{formatBytes(p.down)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trafficHistory.length > 1 && (
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>نمودار مصرف (↑ سبز / ↓ آبی)</p>
                <div className="flex items-end gap-1 h-20" dir="ltr">
                  {trafficHistory.slice(-20).map((p, i) => {
                    const maxVal = Math.max(...trafficHistory.map((t) => Math.max(t.up, t.down)), 1);
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                        <div className="w-full rounded-t" style={{ height: `${(p.up / maxVal) * 100}%`, backgroundColor: "#22c55e", minHeight: p.up > 0 ? "2px" : "0" }} />
                        <div className="w-full rounded-t" style={{ height: `${(p.down / maxVal) * 100}%`, backgroundColor: "#3b82f6", minHeight: p.down > 0 ? "2px" : "0" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={closeTrafficModal} className="flex-1 py-2.5 rounded text-sm transition" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>بستن</button>
            </div>
          </div>
        </div>
        </FocusTrap>
      )}
    </div>
  );
}
