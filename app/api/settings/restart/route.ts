import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  try {
    const { execSync } = await import("child_process");
    execSync("systemctl restart 3xui-manager", { timeout: 10000 });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا در ریستارت: " + e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "سرویس ریستارت شد" });
}
