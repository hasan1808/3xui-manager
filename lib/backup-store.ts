import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import { getAllPanels } from "./panel-store";
import { readSettings, writeSettings } from "./settings-store";

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const PANEL_BACKUP_DIR = path.join(BACKUP_DIR, "panels");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function listPanelBackups(panelId?: string): { file: string; date: string; panelId: string; panelName: string }[] {
  ensureDir(PANEL_BACKUP_DIR);
  const results: { file: string; date: string; panelId: string; panelName: string }[] = [];
  if (!fs.existsSync(PANEL_BACKUP_DIR)) return results;
  const dirs = panelId ? [panelId] : fs.readdirSync(PANEL_BACKUP_DIR).filter((d) => {
    const p = path.join(PANEL_BACKUP_DIR, d);
    return fs.statSync(p).isDirectory();
  });
  const panels = getAllPanels();
  for (const id of dirs) {
    const d = path.join(PANEL_BACKUP_DIR, id);
    if (!fs.existsSync(d)) continue;
    const files = fs.readdirSync(d).filter((f) => f.endsWith(".db")).sort();
    const panelName = panels.find((p) => p.id === id)?.name || id;
    for (const f of files) {
      const stat = fs.statSync(path.join(d, f));
      results.push({ file: path.join(id, f), date: stat.mtime.toISOString(), panelId: id, panelName });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export function savePanelBackupBinary(panelId: string, buffer: Buffer, filename: string): string {
  ensureDir(path.join(PANEL_BACKUP_DIR, panelId));
  const file = path.join(PANEL_BACKUP_DIR, panelId, filename);
  fs.writeFileSync(file, buffer);
  return file;
}

export function readPanelBackupBinary(relativePath: string): Buffer | null {
  const full = path.resolve(PANEL_BACKUP_DIR, relativePath);
  if (!full.startsWith(PANEL_BACKUP_DIR)) return null;
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

export function getPanelBackupInfo(relativePath: string): { filename: string; size: number } | null {
  const full = path.resolve(PANEL_BACKUP_DIR, relativePath);
  if (!full.startsWith(PANEL_BACKUP_DIR)) return null;
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  return { filename: path.basename(relativePath), size: stat.size };
}

export async function deletePanelBackup(relativePath: string): Promise<boolean> {
  const full = path.resolve(PANEL_BACKUP_DIR, relativePath);
  if (!full.startsWith(PANEL_BACKUP_DIR)) return false;
  return withLock("backups", () => {
    if (!fs.existsSync(full)) return false;
    fs.unlinkSync(full);
    const dir = path.dirname(full);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
    return true;
  });
}

export function getSystemBackup(): any {
  const panels = getAllPanels();
  const settings = readSettings();
  return { panels, settings, exportedAt: new Date().toISOString() };
}

export async function restoreSystemBackup(data: any): Promise<{ ok: boolean; message: string }> {
  if (!data || !data.panels || !data.settings) {
    return { ok: false, message: "فرمت فایل نادرست است" };
  }
  if (!Array.isArray(data.panels)) {
    return { ok: false, message: "پنل‌ها باید آرایه باشند" };
  }
  return withLock("panels", async () => {
    const panelsFile = path.join(process.cwd(), "data", "panels.json");
    writeFileAtomic(panelsFile, JSON.stringify(data.panels, null, 2));
    await writeSettings(data.settings);
    return { ok: true, message: `بازیابی شد: ${data.panels.length} پنل` };
  });
}
