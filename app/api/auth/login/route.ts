import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getJwtSecretBytes } from "@/lib/secret";
import { getAdminPassword, getAdminUsername } from "@/lib/admin-store";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 5;
const RATE_WINDOW = 60000;
const CLEANUP_INTERVAL = 300000;
let lastCleanup = Date.now();

function cleanupRateLimit() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimit) {
    if (now > entry.resetAt) rateLimit.delete(ip);
  }
}

function checkRateLimit(ip: string): boolean {
  cleanupRateLimit();
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "تلاش زیاد. بعداً تلاش کنید" }, { status: 429 });
  }

  const { username, password } = await req.json();
  const adminUser = getAdminUsername();
  const adminPass = getAdminPassword();

  if (username !== adminUser || password !== adminPass) {
    return NextResponse.json({ error: "نام کاربری یا رمز اشتباه است" }, { status: 401 });
  }

  const token = await new SignJWT({ username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getJwtSecretBytes());

  const res = NextResponse.json({ token });
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.SSL_ENABLED === "true",
    sameSite: "lax",
    maxAge: 86400,
  });
  return res;
}
