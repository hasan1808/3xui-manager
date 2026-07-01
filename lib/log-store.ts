import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";
import { generateId } from "./utils";

const LOGS_FILE = path.join(process.cwd(), "data", "logs.json");

export interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
}

function readLogs(): LogEntry[] {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
  }
  catch { return []; }
}

export function getLogs(limit: number = 500): LogEntry[] {
  return readLogs().slice(0, limit);
}

export function clearLogs(): void {
  writeFileAtomic(LOGS_FILE, "[]");
}

export async function addLog(action: string, detail: string): Promise<void> {
  await withLock("logs", () => {
    const logs = readLogs();
    logs.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
    if (logs.length > 5000) logs.length = 5000;
    writeFileAtomic(LOGS_FILE, JSON.stringify(logs, null, 2));
  });
}
