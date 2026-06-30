import fs from "fs";
import path from "path";
import crypto from "crypto";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "wallet-requests.json");

export interface WalletRequest {
  id: string;
  adminId: string;
  adminUsername: string;
  amount: number;
  description: string;
  receipt?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): WalletRequest[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeRaw(list: WalletRequest[]): void {
  writeFileAtomic(FILE, JSON.stringify(list, null, 2));
}

export function getAllRequests(): WalletRequest[] {
  return readRaw();
}

export function getPendingRequests(): WalletRequest[] {
  return readRaw().filter((r) => r.status === "pending");
}

export function getRequestsByAdmin(adminId: string): WalletRequest[] {
  return readRaw().filter((r) => r.adminId === adminId);
}

export async function createRequest(adminId: string, adminUsername: string, amount: number, description: string, receipt?: string): Promise<WalletRequest> {
  return withLock("wallet-requests", () => {
    const list = readRaw();
    const request: WalletRequest = {
      id: crypto.randomUUID(),
      adminId,
      adminUsername,
      amount,
      description,
      receipt,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    list.push(request);
    writeRaw(list);
    return request;
  });
}

export async function resolveRequest(id: string, status: "approved" | "rejected", resolvedBy: string): Promise<WalletRequest | null> {
  return withLock("wallet-requests", () => {
    const list = readRaw();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    list[idx].resolvedAt = new Date().toISOString();
    list[idx].resolvedBy = resolvedBy;
    writeRaw(list);
    return list[idx];
  });
}
