import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import { getAdmins } from "./admin-store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "inbound-ownership.json");

export interface InboundOwnership {
  panelId: string;
  inboundId: number;
  assignedTo: string;
  assignedAt: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): InboundOwnership[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")); } catch { return []; }
}

function writeRaw(list: InboundOwnership[]) {
  writeFileAtomic(FILE, JSON.stringify(list, null, 2));
}

export function getAssignedInbounds(panelId: string, adminId: string): number[] {
  return readRaw().filter((o) => o.panelId === panelId && o.assignedTo === adminId).map((o) => o.inboundId);
}

export function getInboundOwner(panelId: string, inboundId: number): string | null {
  return readRaw().find((o) => o.panelId === panelId && o.inboundId === inboundId)?.assignedTo || null;
}

export function getInboundAssignments(panelId: string, inboundId: number): { id: string; username: string }[] {
  const data = readRaw().filter((o) => o.panelId === panelId && o.inboundId === inboundId);
  const allAdmins = getAdmins();
  return data
    .map((o) => allAdmins.find((a) => a.id === o.assignedTo))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ id: a.id, username: a.username }));
}

export function getPanelAssignments(panelId: string): InboundOwnership[] {
  return readRaw().filter((o) => o.panelId === panelId);
}

export async function assignInbound(panelId: string, inboundId: number, adminId: string): Promise<void> {
  return withLock("inbound-ownership", () => {
    const list = readRaw();
    const exists = list.some((o) => o.panelId === panelId && o.inboundId === inboundId && o.assignedTo === adminId);
    if (!exists) {
      list.push({ panelId, inboundId, assignedTo: adminId, assignedAt: new Date().toISOString() });
    }
    writeRaw(list);
  });
}

export async function unassignInbound(panelId: string, inboundId: number, adminId: string): Promise<void> {
  return withLock("inbound-ownership", () => {
    const list = readRaw().filter((o) => !(o.panelId === panelId && o.inboundId === inboundId && o.assignedTo === adminId));
    writeRaw(list);
  });
}
