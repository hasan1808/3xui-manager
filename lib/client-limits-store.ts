import fs from "fs";
import path from "path";
import crypto from "crypto";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const GROUPS_FILE = path.join(DATA_DIR, "client-groups.json");
const LIMITS_FILE = path.join(DATA_DIR, "client-limits.json");
const TRAFFIC_FILE = path.join(DATA_DIR, "client-monthly-traffic.json");

export interface ClientGroup {
  id: string;
  name: string;
  color: string;
  defaultTrafficLimitGb: number | null;
  defaultExpiryDays: number | null;
  createdAt: string;
}

export interface ClientLimit {
  id: string;
  panelId: string;
  clientEmail: string;
  groupId: string | null;
  monthlyTrafficLimitGb: number | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MonthlyTrafficEntry {
  panelId: string;
  clientEmail: string;
  month: string;
  totalUp: number;
  totalDown: number;
  lastUpdated: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readGroups(): ClientGroup[] {
  ensureDir();
  if (!fs.existsSync(GROUPS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(GROUPS_FILE, "utf-8")); } catch { return []; }
}

function writeGroups(groups: ClientGroup[]) {
  writeFileAtomic(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

function readLimits(): ClientLimit[] {
  ensureDir();
  if (!fs.existsSync(LIMITS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LIMITS_FILE, "utf-8")); } catch { return []; }
}

function writeLimits(limits: ClientLimit[]) {
  writeFileAtomic(LIMITS_FILE, JSON.stringify(limits, null, 2));
}

function readTraffic(): MonthlyTrafficEntry[] {
  ensureDir();
  if (!fs.existsSync(TRAFFIC_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TRAFFIC_FILE, "utf-8")); } catch { return []; }
}

function writeTraffic(data: MonthlyTrafficEntry[]) {
  writeFileAtomic(TRAFFIC_FILE, JSON.stringify(data, null, 2));
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// --- Groups ---
export function getAllGroups(): ClientGroup[] { return readGroups(); }

export async function addGroup(name: string, color: string, defaultTrafficLimitGb: number | null, defaultExpiryDays: number | null): Promise<ClientGroup> {
  return withLock("client-groups", () => {
    const groups = readGroups();
    const group: ClientGroup = {
      id: crypto.randomUUID(),
      name,
      color,
      defaultTrafficLimitGb,
      defaultExpiryDays,
      createdAt: new Date().toISOString(),
    };
    groups.push(group);
    writeGroups(groups);
    return group;
  });
}

export async function updateGroup(id: string, updates: Partial<Pick<ClientGroup, "name" | "color" | "defaultTrafficLimitGb" | "defaultExpiryDays">>): Promise<ClientGroup | null> {
  return withLock("client-groups", () => {
    const groups = readGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    groups[idx] = { ...groups[idx], ...updates };
    writeGroups(groups);
    return groups[idx];
  });
}

export async function deleteGroup(id: string): Promise<boolean> {
  return withLock("client-groups", () => {
    const groups = readGroups();
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    groups.splice(idx, 1);
    writeGroups(groups);
    const limits = readLimits();
    limits.forEach((l) => { if (l.groupId === id) l.groupId = null; });
    writeLimits(limits);
    return true;
  });
}

// --- Limits ---
export function getAllLimits(): ClientLimit[] { return readLimits(); }

export function getLimitByClient(panelId: string, clientEmail: string): ClientLimit | undefined {
  return readLimits().find((l) => l.panelId === panelId && l.clientEmail === clientEmail);
}

export async function setClientLimit(panelId: string, clientEmail: string, groupId: string | null, monthlyTrafficLimitGb: number | null, expiryDate: string | null): Promise<ClientLimit> {
  return withLock("client-limits", () => {
    const limits = readLimits();
    const idx = limits.findIndex((l) => l.panelId === panelId && l.clientEmail === clientEmail);
    const now = new Date().toISOString();
    if (idx >= 0) {
      limits[idx] = { ...limits[idx], groupId, monthlyTrafficLimitGb, expiryDate, updatedAt: now };
      writeLimits(limits);
      return limits[idx];
    }
    const entry: ClientLimit = {
      id: crypto.randomUUID(),
      panelId,
      clientEmail,
      groupId,
      monthlyTrafficLimitGb,
      expiryDate,
      createdAt: now,
      updatedAt: now,
    };
    limits.push(entry);
    writeLimits(limits);
    return entry;
  });
}

export async function deleteClientLimit(panelId: string, clientEmail: string): Promise<boolean> {
  return withLock("client-limits", () => {
    const limits = readLimits();
    const idx = limits.findIndex((l) => l.panelId === panelId && l.clientEmail === clientEmail);
    if (idx === -1) return false;
    limits.splice(idx, 1);
    writeLimits(limits);
    return true;
  });
}

// --- Monthly Traffic ---
export async function recordClientTraffic(panelId: string, clientEmail: string, up: number, down: number) {
  await withLock("client-monthly-traffic", () => {
    const traffic = readTraffic();
    const month = getCurrentMonth();
    const idx = traffic.findIndex((t) => t.panelId === panelId && t.clientEmail === clientEmail && t.month === month);
    if (idx >= 0) {
      traffic[idx].totalUp = up;
      traffic[idx].totalDown = down;
      traffic[idx].lastUpdated = new Date().toISOString();
    } else {
      traffic.push({ panelId, clientEmail, month, totalUp: up, totalDown: down, lastUpdated: new Date().toISOString() });
    }
    writeTraffic(traffic);
  });
}

export function getClientTraffic(panelId: string, clientEmail: string): { totalUp: number; totalDown: number; totalGb: number } {
  const traffic = readTraffic();
  const month = getCurrentMonth();
  const entry = traffic.find((t) => t.panelId === panelId && t.clientEmail === clientEmail && t.month === month);
  if (!entry) return { totalUp: 0, totalDown: 0, totalGb: 0 };
  const totalBytes = entry.totalUp + entry.totalDown;
  return { totalUp: entry.totalUp, totalDown: entry.totalDown, totalGb: Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100 };
}

export function getAllMonthlyTraffic(): MonthlyTrafficEntry[] {
  return readTraffic().filter((t) => t.month === getCurrentMonth());
}

export function getLimitsWithTraffic(): (ClientLimit & { trafficGb: number; groupName: string | null })[] {
  const limits = readLimits();
  const groups = readGroups();
  const month = getCurrentMonth();
  const traffic = readTraffic().filter((t) => t.month === month);

  return limits.map((l) => {
    const t = traffic.find((tr) => tr.panelId === l.panelId && tr.clientEmail === l.clientEmail);
    const totalBytes = t ? t.totalUp + t.totalDown : 0;
    const trafficGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
    const group = groups.find((g) => g.id === l.groupId);
    return { ...l, trafficGb, groupName: group?.name || null };
  });
}
