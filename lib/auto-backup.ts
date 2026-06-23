import { readSettings } from "./settings-store";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let _initGuard = false;

async function runBackup() {
  if (running) return;
  running = true;
  const { getAllPanels } = await import("./panel-store");
  const { getXuiClient } = await import("./xui-api");
  const { savePanelBackupBinary } = await import("./backup-store");
  const { addLog } = await import("./log-store");

  const panels = getAllPanels();
  let ok = 0, fail = 0;
  for (const panel of panels) {
    try {
      const client = getXuiClient(panel);
      await client.ensureLogin(panel.username, panel.password);
      const authHeaders = client.getAuthHeaders();
      const res = await fetch(`${client.getBaseUrl()}/panel/api/server/getDb`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) throw new Error("فایل خالی");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      savePanelBackupBinary(panel.id, buffer, `${ts}.db`);
      ok++;
    } catch {
      fail++;
    }
  }
  await addLog(`بکاپ خودکار`, `بکاپ خودکار: ${ok} موفق، ${fail} ناموفق از ${panels.length} پنل`);
  running = false;
}

export function startAutoBackup(intervalHours: number) {
  stopAutoBackup();
  if (intervalHours <= 0) return;
  const ms = intervalHours * 60 * 60 * 1000;
  timer = setInterval(runBackup, ms);
}

export function stopAutoBackup() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function getAutoBackupStatus() {
  return { active: timer !== null, running };
}

export async function triggerAutoBackup() {
  await runBackup();
}

export function initAutoBackupIfNeeded() {
  if (_initGuard) return;
  _initGuard = true;
  const settings = readSettings();
  if (settings.autoBackup) {
    startAutoBackup(settings.autoBackupInterval);
  }
}
