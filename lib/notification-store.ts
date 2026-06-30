import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "notification-settings.json");

export interface NotificationSettings {
  telegramBotToken: string;
  telegramChatId: string;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  dailyReport: boolean;
  enabled: boolean;
}

const defaults: NotificationSettings = {
  telegramBotToken: "",
  telegramChatId: "",
  lowBalanceAlert: true,
  lowBalanceThreshold: 50000,
  dailyReport: false,
  enabled: false,
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): NotificationSettings {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    writeFileAtomic(FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return { ...defaults, ...JSON.parse(fs.readFileSync(FILE, "utf-8")) };
}

export function getNotificationSettings(): NotificationSettings {
  return readRaw();
}

export async function setNotificationSettings(updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
  return withLock("notification-settings", () => {
    const current = readRaw();
    const updated = { ...current, ...updates };
    writeFileAtomic(FILE, JSON.stringify(updated, null, 2));
    return updated;
  });
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  const settings = readRaw();
  if (!settings.enabled || !settings.telegramBotToken || !settings.telegramChatId) {
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function checkLowBalances(): { username: string; balance: number; threshold: number }[] {
  const settings = readRaw();
  if (!settings.lowBalanceAlert) return [];
  const { getAdmins } = require("./admin-store");
  const admins = getAdmins() as { username: string; balance: number }[];
  return admins
    .filter((a) => a.balance < settings.lowBalanceThreshold)
    .map((a) => ({ username: a.username, balance: a.balance, threshold: settings.lowBalanceThreshold }));
}
