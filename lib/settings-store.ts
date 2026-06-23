import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export interface AppSettings {
  theme: "dark" | "light" | "system";
  dashboardRefreshInterval: number;
  autoBackup: boolean;
  autoBackupInterval: number;
  toastDuration: number;
  panelTimeout: number;
  panelRetryAttempts: number;
  compactSidebar: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  dashboardRefreshInterval: 30,
  autoBackup: false,
  autoBackupInterval: 24,
  toastDuration: 3,
  panelTimeout: 10,
  panelRetryAttempts: 3,
  compactSidebar: false,
};

export function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function writeSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  return withLock("settings", () => {
    const current = readSettings();
    const merged = { ...current, ...settings };
    try {
      writeFileAtomic(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    } catch (e) {
      console.error("Failed to write settings:", e);
    }
    return merged;
  });
}
