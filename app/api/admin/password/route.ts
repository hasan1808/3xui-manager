import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { updateAdmin, getAdminById, comparePassword } from "@/lib/admin-store";
import { addLog } from "@/lib/log-store";

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  const admin = getAdminById(user.userId);
  if (!admin) return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });
  if (!comparePassword(currentPassword, admin.password)) {
    return NextResponse.json({ error: "رمز فعلی اشتباه است" }, { status: 403 });
  }
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "رمز جدید حداقل ۴ کاراکتر" }, { status: 400 });
  }
  try {
    await updateAdmin(admin.id, { password: newPassword });
    await addLog("change_password", "رمز عبور تغییر یافت");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا در ذخیره: " + (e.message || "") }, { status: 500 });
  }
}
