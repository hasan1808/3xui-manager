import fs from "fs";
import path from "path";
import crypto from "crypto";
import { withLock, writeFileAtomic } from "./lock";
import { getPricing } from "./finance-store";
import { getPanel } from "./panel-store";
import { getAdminByUsername } from "./admin-store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "client-pricing.json");

export interface ClientPrice {
  id: string;
  panelId: string;
  adminUsername: string;
  pricePerGb: number;
  createdAt: string;
  updatedAt: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function migrateData(list: any[]): ClientPrice[] {
  let changed = false;
  const migrated = list.map((item: any) => {
    if (item.clientEmail && !item.adminUsername) {
      changed = true;
      const { clientEmail, ...rest } = item;
      return { ...rest, adminUsername: clientEmail };
    }
    return item;
  });
  if (changed) writeFileAtomic(FILE, JSON.stringify(migrated, null, 2));
  return migrated;
}

function readRaw(): ClientPrice[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return migrateData(data);
  } catch {
    return [];
  }
}

export function getAllClientPrices(): ClientPrice[] {
  return readRaw();
}

export function getClientPrice(panelId: string, adminUsername: string): ClientPrice | undefined {
  return readRaw().find((c) => c.panelId === panelId && c.adminUsername === adminUsername);
}

export async function setClientPrice(panelId: string, adminUsername: string, pricePerGb: number): Promise<ClientPrice> {
  return withLock("client-pricing", () => {
    const list = readRaw();
    const idx = list.findIndex((c) => c.panelId === panelId && c.adminUsername === adminUsername);
    const now = new Date().toISOString();
    if (idx >= 0) {
      list[idx].pricePerGb = pricePerGb;
      list[idx].updatedAt = now;
      writeFileAtomic(FILE, JSON.stringify(list, null, 2));
      return list[idx];
    }
    const entry: ClientPrice = {
      id: crypto.randomUUID(),
      panelId,
      adminUsername,
      pricePerGb,
      createdAt: now,
      updatedAt: now,
    };
    list.push(entry);
    writeFileAtomic(FILE, JSON.stringify(list, null, 2));
    return entry;
  });
}

export async function removeClientPrice(panelId: string, adminUsername: string): Promise<void> {
  return withLock("client-pricing", () => {
    const list = readRaw().filter((c) => !(c.panelId === panelId && c.adminUsername === adminUsername));
    writeFileAtomic(FILE, JSON.stringify(list, null, 2));
  });
}

export function resolvePrice(panelId: string, adminUsername?: string): number {
  const globalPricing = getPricing();
  if (adminUsername) {
    const cp = getClientPrice(panelId, adminUsername);
    if (cp) return cp.pricePerGb;
  }
  const panel = getPanel(panelId);
  if (panel?.pricePerGb != null) return panel.pricePerGb;
  return globalPricing.pricePerGb;
}
