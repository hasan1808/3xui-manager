import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { execSync } from "child_process";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  setTimeout(() => {
    try { execSync("systemctl restart 3xui-manager", { timeout: 10000 }); } catch {}
  }, 1000);

  return NextResponse.json({ ok: true, message: "سرویس در حال ریستارت..." });
}
