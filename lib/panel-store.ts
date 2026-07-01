import { Panel } from "./types";
import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import { generateId } from "./utils";

const DATA_FILE = path.join(process.cwd(), "data", "panels.json");

function ensureDataFile(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}

function migratePanels(panels: Panel[]): Panel[] {
  let changed = false;
  const migrated = panels.map((p) => {
    if (!p.ownerId) {
      changed = true;
      return { ...p, ownerId: "legacy" };
    }
    return p;
  });
  if (changed) writePanels(migrated);
  return migrated;
}

function readPanels(): Panel[] {
  ensureDataFile();
  try {
    const panels = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return migratePanels(panels);
  } catch {
    return [];
  }
}

function writePanels(panels: Panel[]): void {
  writeFileAtomic(DATA_FILE, JSON.stringify(panels, null, 2));
}

export function getAllPanels(): Panel[] {
  return readPanels();
}

export function getPanel(id: string): Panel | undefined {
  return readPanels().find((p) => p.id === id);
}

export async function addPanel(panel: Omit<Panel, "id" | "createdAt">): Promise<Panel> {
  return withLock("panels", () => {
    const panels = readPanels();
    const newPanel: Panel = {
      ...panel,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    panels.push(newPanel);
    writePanels(panels);
    return newPanel;
  });
}

export async function updatePanel(id: string, data: Partial<Panel>): Promise<Panel | null> {
  return withLock("panels", () => {
    const panels = readPanels();
    const idx = panels.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    panels[idx] = { ...panels[idx], ...data };
    writePanels(panels);
    return panels[idx];
  });
}

export async function deletePanel(id: string): Promise<boolean> {
  return withLock("panels", () => {
    const panels = readPanels();
    const filtered = panels.filter((p) => p.id !== id);
    if (filtered.length === panels.length) return false;
    writePanels(filtered);
    return true;
  });
}

export async function reorderPanels(ids: string[]): Promise<boolean> {
  return withLock("panels", () => {
    const panels = readPanels();
    const map = new Map(panels.map((p) => [p.id, p]));
    const reordered = ids.map((id) => map.get(id)).filter(Boolean) as Panel[];
    if (reordered.length !== panels.length) return false;
    writePanels(reordered);
    return true;
  });
}
