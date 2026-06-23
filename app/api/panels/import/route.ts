import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { withLock, writeFileAtomic } from "@/lib/lock";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "panels.json");

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "فرمت فایل باید آرایه باشد" }, { status: 400 });
    }
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await withLock("panels", () => {
      writeFileAtomic(DATA_FILE, JSON.stringify(body, null, 2));
    });
    return NextResponse.json({ ok: true, count: body.length });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}
