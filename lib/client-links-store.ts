import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";

const DATA_FILE = path.join(process.cwd(), "data", "client-links.json");

export interface ClientLinkEntry {
  panelId: string;
  inboundId: number;
  email: string;
  configLink: string;
  subLinks: string[];
  updatedAt: string;
}

export interface ClientLinksData {
  links: ClientLinkEntry[];
  subUrls: Record<string, string>;
}

function ensureDataFile(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ links: [], subUrls: {} }, null, 2), "utf-8");
}

function readData(): ClientLinksData {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { links: [], subUrls: {} };
  }
}

function writeData(data: ClientLinksData): void {
  writeFileAtomic(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getClientLink(panelId: string, inboundId: number, email: string): ClientLinkEntry | undefined {
  return readData().links.find((l) => l.panelId === panelId && l.inboundId === inboundId && l.email === email);
}

export function getPanelLinks(panelId: string): ClientLinkEntry[] {
  return readData().links.filter((l) => l.panelId === panelId);
}

export function getSubUrl(panelId: string, subId: string): string {
  return readData().subUrls[`${panelId}:${subId}`] || "";
}

export async function setClientLink(panelId: string, inboundId: number, email: string, configLink: string, subLinks: string[]): Promise<void> {
  await withLock("client-links", () => {
    const data = readData();
    const idx = data.links.findIndex((l) => l.panelId === panelId && l.inboundId === inboundId && l.email === email);
    const entry: ClientLinkEntry = { panelId, inboundId, email, configLink, subLinks, updatedAt: new Date().toISOString() };
    if (idx >= 0) data.links[idx] = entry;
    else data.links.push(entry);
    writeData(data);
  });
}

export async function setSubUrl(panelId: string, subId: string, url: string): Promise<void> {
  await withLock("client-links", () => {
    const data = readData();
    data.subUrls[`${panelId}:${subId}`] = url;
    writeData(data);
  });
}

export async function removeClientLink(panelId: string, inboundId: number, email: string): Promise<void> {
  await withLock("client-links", () => {
    const data = readData();
    data.links = data.links.filter((l) => !(l.panelId === panelId && l.inboundId === inboundId && l.email === email));
    writeData(data);
  });
}

export async function removePanelLinks(panelId: string): Promise<void> {
  await withLock("client-links", () => {
    const data = readData();
    data.links = data.links.filter((l) => l.panelId !== panelId);
    Object.keys(data.subUrls).forEach((k) => { if (k.startsWith(panelId + ":")) delete data.subUrls[k]; });
    writeData(data);
  });
}

export function getAllClientLinks(): ClientLinksData {
  return readData();
}
