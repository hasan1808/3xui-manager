import fs from "fs";

const locks = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => T): Promise<T> {
  while (locks.has(key)) {
    await locks.get(key);
  }
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  locks.set(key, promise);
  try {
    return await fn();
  } finally {
    locks.delete(key);
    resolve();
  }
}

export function writeFileAtomic(filePath: string, data: string): void {
  const tmp = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmp, data, "utf-8");
  fs.renameSync(tmp, filePath);
}
