import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { getAdminPassword, setAdminPassword } from "@/lib/admin-store";
import { addLog } from "@/lib/log-store";

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { currentPassword, newPassword } = await req.json();
  const adminPass = getAdminPassword();
  if (currentPassword !== adminPass) {
    return NextResponse.json({ error: "رمز فعلی اشتباه است" }, { status: 403 });
  }
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "رمز جدید حداقل ۴ کاراکتر" }, { status: 400 });
  }
  try {
    await setAdminPassword(newPassword);
    process.env.ADMIN_PASS = newPassword;
    await addLog("change_password", "رمز ادمین تغییر یافت");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا در ذخیره: " + (e.message || "") }, { status: 500 });
  }
}
