import { NextResponse } from "next/server";

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();
const RATE_MAX = 10;
const RATE_WINDOW = 60000;
const CLEANUP_INTERVAL = 300000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }
}

export function checkRateLimit(ip: string, storeName = "default"): boolean {
  cleanup();
  if (!stores.has(storeName)) stores.set(storeName, new Map());
  const store = stores.get(storeName)!;
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export function rateLimitMiddleware(storeName = "default", maxAttempts = RATE_MAX) {
  return (req: Request): { passed: boolean; response: Response | undefined } => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip, storeName)) {
      return { passed: false, response: NextResponse.json({ error: "تلاش زیاد. بعداً تلاش کنید" }, { status: 429 }) };
    }
    return { passed: true, response: undefined };
  };
}
