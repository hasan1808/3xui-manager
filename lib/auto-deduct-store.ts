import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import type { XUIClient } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "auto-deduct.json");

export interface AutoDeductSettings {
  enabled: boolean;
  runHour: number;
  runMinute: number;
  lastRun: string | null;
  lastResult: string | null;
}

interface ClientTraffic {
  email: string;
  inboundId: number;
  totalBytes: number;
}

interface PanelClientsSnapshot {
  panelId: string;
  clients: ClientTraffic[];
  recordedAt: string;
}

interface ClientTrafficHistory {
  snapshots: PanelClientsSnapshot[];
}

const TRAFFIC_FILE = path.join(DATA_DIR, "traffic-snapshots.json");

const defaults: AutoDeductSettings = {
  enabled: false,
  runHour: 2,
  runMinute: 0,
  lastRun: null,
  lastResult: null,
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSettingsRaw(): AutoDeductSettings {
  ensureDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeFileAtomic(SETTINGS_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) };
}

export function getAutoDeductSettings(): AutoDeductSettings {
  return readSettingsRaw();
}

export async function setAutoDeductSettings(updates: Partial<AutoDeductSettings>): Promise<AutoDeductSettings> {
  return withLock("auto-deduct", () => {
    const current = readSettingsRaw();
    const updated = { ...current, ...updates };
    writeFileAtomic(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
  });
}

function readTrafficHistory(): ClientTrafficHistory {
  ensureDir();
  if (!fs.existsSync(TRAFFIC_FILE)) return { snapshots: [] };
  try { return JSON.parse(fs.readFileSync(TRAFFIC_FILE, "utf-8")); } catch { return { snapshots: [] }; }
}

function writeTrafficHistory(data: ClientTrafficHistory) {
  writeFileAtomic(TRAFFIC_FILE, JSON.stringify(data, null, 2));
}

function getLastClientTraffic(panelId: string, inboundId: number, email: string): number {
  const history = readTrafficHistory();
  const snap = history.snapshots.find((s) => s.panelId === panelId);
  if (!snap || !Array.isArray(snap.clients)) return 0;
  const client = snap.clients.find((c) => c.inboundId === inboundId && c.email === email);
  return client?.totalBytes || 0;
}

async function saveClientTraffic(panelId: string, clients: ClientTraffic[]) {
  await withLock("traffic-snapshots", () => {
    const history = readTrafficHistory();
    const idx = history.snapshots.findIndex((s) => s.panelId === panelId);
    const entry: PanelClientsSnapshot = { panelId, clients, recordedAt: new Date().toISOString() };
    if (idx >= 0) history.snapshots[idx] = entry;
    else history.snapshots.push(entry);
    writeTrafficHistory(history);
  });
}

export async function runAutoDeduct(): Promise<{ ok: boolean; message: string; results: { panelName: string; deltaGb: number; cost: number }[] }> {
  const { getAllPanels } = await import("./panel-store");
  const { getXuiClient } = await import("./xui-api");
  const { addTransaction } = await import("./finance-store");
  const { getAdmins, getAdminById, updateAdmin } = await import("./admin-store");
  const { sendTelegramMessage, getNotificationSettings } = await import("./notification-store");
  const { addLog } = await import("./log-store");
  const { recordTrafficSnapshot } = await import("./traffic-history-store");
  const { resolvePrice } = await import("./client-pricing-store");
  const { getInboundAssignments } = await import("./inbound-ownership-store");

  const panels = getAllPanels();
  const results: { panelName: string; deltaGb: number; cost: number }[] = [];
  let totalDeltaBytes = 0;
  const adminDeductions: Record<string, { username: string; cost: number; details: string[] }> = {};

  for (const panel of panels) {
    try {
      const xui = getXuiClient(panel);
      await xui.ensureLogin(panel.username, panel.password);
      const inbounds = await xui.getInbounds();

      let totalUp = 0, totalDown = 0;
      let clientCount = 0;
      const clientTrafficList: ClientTraffic[] = [];

      for (const inb of inbounds) {
        totalUp += (inb.up || 0);
        totalDown += (inb.down || 0);
        let inbClients: XUIClient[] = (inb as any).clients || [];
        if (inbClients.length === 0) {
          try {
            const rawSettings = (inb as any).settings;
            const s = typeof rawSettings === "string" ? JSON.parse(rawSettings) : (rawSettings || {});
            inbClients = s.clients || [];
          } catch {}
        }
        clientCount += inbClients.length;

        // Per-inbound traffic tracking
        const inbBytes = (inb.up || 0) + (inb.down || 0);
        const clientKey = `inb:${inb.id}`;
        clientTrafficList.push({ email: clientKey, inboundId: inb.id, totalBytes: inbBytes });

        const prevBytes = getLastClientTraffic(panel.id, inb.id, clientKey);
        const delta = Math.max(0, inbBytes - prevBytes);
        if (delta > 0) {
          const deltaGb = delta / (1024 * 1024 * 1024);
          const assignedAdmins = getInboundAssignments(panel.id, inb.id);
          if (assignedAdmins.length > 0) {
            for (const aa of assignedAdmins) {
              const effectivePrice = resolvePrice(panel.id, aa.username);
              const adminCost = Math.round(deltaGb * effectivePrice / assignedAdmins.length);
              if (!adminDeductions[aa.id]) adminDeductions[aa.id] = { username: aa.username, cost: 0, details: [] };
              adminDeductions[aa.id].cost += adminCost;
              adminDeductions[aa.id].details.push(`${panel.name}/${inb.remark} (${Math.round(deltaGb * 100) / 100} GB)`);
            }
            totalDeltaBytes += delta;
          }
        }
      }

      let onlineCount = 0;
      try { const onlines = await xui.getOnlineClients(); onlineCount = onlines.length; } catch {}
      await recordTrafficSnapshot(panel.id, panel.name, totalUp, totalDown, clientCount, onlineCount);
      await saveClientTraffic(panel.id, clientTrafficList);
    } catch (e) {
      console.error(`Auto-deduct error on panel ${panel.name}:`, e);
    }
  }

  const deductionIds = Object.keys(adminDeductions);
  await Promise.all(deductionIds.map(async (adminId) => {
    const d = adminDeductions[adminId];
    if (d.cost <= 0) return;
    const admin = getAdminById(adminId);
    if (!admin) return;
    const newBalance = admin.balance - d.cost;
    await addTransaction({
      adminId,
      adminUsername: d.username,
      type: "usage",
      amount: -d.cost,
      balanceBefore: admin.balance,
      balanceAfter: newBalance,
      description: `کسر خودکار: ${d.details.join(", ")}`,
    });
    await updateAdmin(adminId, { balance: newBalance });
    admin.balance = newBalance;
  }));

  const totalCost = Object.values(adminDeductions).reduce((s, d) => s + d.cost, 0);
  const totalDeltaGb = Math.round((totalDeltaBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const dedCount = Object.keys(adminDeductions).length;
  const msg = totalCost > 0
    ? `کسر خودکار: ${totalDeltaGb} GB — ${totalCost.toLocaleString()} تومان از ${dedCount} مشتری`
    : `حسابرسی خودکار: ${panels.length} پنل – ${totalDeltaGb} GB (بدون کسر)`;

  await addLog("auto_deduct", msg);

  const admins = getAdmins();
  for (const a of admins) {
    const notif = getNotificationSettings();
    if (notif.enabled && notif.lowBalanceAlert && adminDeductions[a.id] && a.balance < notif.lowBalanceThreshold) {
      await sendTelegramMessage(`⚠️ موجودی کم!\nمشتری: ${a.username}\nموجودی: ${a.balance.toLocaleString()} تومان\nآستانه: ${notif.lowBalanceThreshold.toLocaleString()} تومان`);
    }
  }

  await setAutoDeductSettings({
    lastRun: new Date().toISOString(),
    lastResult: `${totalDeltaGb} GB — ${totalCost.toLocaleString()} تومان`,
  });

  const allResults = results.length > 0 ? results : [];
  return { ok: true, message: msg, results: allResults };
}

let nightlyTimer: ReturnType<typeof setTimeout> | null = null;
let _started = false;

function scheduleNext() {
  if (nightlyTimer) clearTimeout(nightlyTimer);
  const settings = readSettingsRaw();
  if (!settings.enabled) return;

  const now = new Date();
  const target = new Date();
  target.setHours(settings.runHour, settings.runMinute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const delay = target.getTime() - now.getTime();
  nightlyTimer = setTimeout(async () => {
    await runAutoDeduct();
    scheduleNext();
  }, delay);
}

export function startAutoDeduct() {
  if (_started) return;
  _started = true;
  scheduleNext();
}

export function stopAutoDeduct() {
  if (nightlyTimer) { clearTimeout(nightlyTimer); nightlyTimer = null; }
  _started = false;
}
