import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "traffic-history.json");

export interface TrafficSnapshot {
  date: string;
  panelId: string;
  panelName: string;
  totalUp: number;
  totalDown: number;
  clientCount: number;
  onlineCount: number;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readHistory(): TrafficSnapshot[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")); } catch { return []; }
}

function writeHistory(data: TrafficSnapshot[]) {
  writeFileAtomic(HISTORY_FILE, JSON.stringify(data, null, 2));
}

export async function recordTrafficSnapshot(panelId: string, panelName: string, totalUp: number, totalDown: number, clientCount: number, onlineCount: number) {
  const today = new Date().toISOString().slice(0, 10);
  await withLock("traffic-history", () => {
    const history = readHistory();
    const idx = history.findIndex((h) => h.date === today && h.panelId === panelId);
    const entry: TrafficSnapshot = { date: today, panelId, panelName, totalUp, totalDown, clientCount, onlineCount };
    if (idx >= 0) history[idx] = entry;
    else history.push(entry);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filtered = history.filter((h) => h.date >= cutoffStr);
    writeHistory(filtered);
  });
}

export function getTrafficHistory(days: number = 30): TrafficSnapshot[] {
  const history = readHistory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return history.filter((h) => h.date >= cutoffStr);
}

export function getDailySummary(days: number = 30): { date: string; totalUp: number; totalDown: number; totalGb: number }[] {
  const history = getTrafficHistory(days);
  const byDate = new Map<string, { totalUp: number; totalDown: number }>();
  for (const h of history) {
    const existing = byDate.get(h.date) || { totalUp: 0, totalDown: 0 };
    existing.totalUp += h.totalUp;
    existing.totalDown += h.totalDown;
    byDate.set(h.date, existing);
  }
  const result = Array.from(byDate.entries())
    .map(([date, data]) => ({
      date,
      totalUp: data.totalUp,
      totalDown: data.totalDown,
      totalGb: Math.round(((data.totalUp + data.totalDown) / (1024 * 1024 * 1024)) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export function getWeeklySummary(weeks: number = 8): { weekStart: string; totalGb: number; totalUp: number; totalDown: number }[] {
  const daily = getDailySummary(weeks * 7);
  const byWeek = new Map<string, { totalUp: number; totalDown: number }>();
  for (const d of daily) {
    const date = new Date(d.date);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    const existing = byWeek.get(weekKey) || { totalUp: 0, totalDown: 0 };
    existing.totalUp += d.totalUp;
    existing.totalDown += d.totalDown;
    byWeek.set(weekKey, existing);
  }
  return Array.from(byWeek.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      totalUp: data.totalUp,
      totalDown: data.totalDown,
      totalGb: Math.round(((data.totalUp + data.totalDown) / (1024 * 1024 * 1024)) * 100) / 100,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
