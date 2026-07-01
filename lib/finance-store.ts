import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import { generateId } from "./utils";

const DATA_DIR = path.join(process.cwd(), "data");
const PRICING_FILE = path.join(DATA_DIR, "pricing.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json");

export interface PricingConfig {
  pricePerGb: number;
  currency: string;
}

export interface Transaction {
  id: string;
  adminId: string;
  adminUsername: string;
  type: "adjustment" | "usage" | "deposit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readPricingRaw(): PricingConfig {
  ensureDir();
  if (!fs.existsSync(PRICING_FILE)) {
    const def: PricingConfig = { pricePerGb: 5000, currency: "تومان" };
    writeFileAtomic(PRICING_FILE, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(PRICING_FILE, "utf-8"));
}

export function getPricing(): PricingConfig {
  return readPricingRaw();
}

export async function setPricing(updates: Partial<PricingConfig>): Promise<PricingConfig> {
  return withLock("pricing", () => {
    const current = readPricingRaw();
    const updated = { ...current, ...updates };
    writeFileAtomic(PRICING_FILE, JSON.stringify(updated, null, 2));
    return updated;
  });
}

export function getTransactions(): Transaction[] {
  ensureDir();
  if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, "utf-8"));
}

export async function addTransaction(tx: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  return withLock("transactions", () => {
    ensureDir();
    const list = getTransactions();
    const entry: Transaction = {
      ...tx,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    if (list.length > 10000) list.length = 10000;
    writeFileAtomic(TRANSACTIONS_FILE, JSON.stringify(list, null, 2));
    return entry;
  });
}

export function calculateTrafficCost(bytesUp: number, bytesDown: number, pricePerGb: number): number {
  const totalBytes = bytesUp + bytesDown;
  const totalGb = totalBytes / (1024 * 1024 * 1024);
  return Math.round(totalGb * pricePerGb);
}
