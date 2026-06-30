import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAdminById, updateAdmin, deleteAdmin } from "@/lib/admin-store";
import { addTransaction } from "@/lib/finance-store";
import { addLog } from "@/lib/log-store";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = getAdminById(id);
  if (!target) return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });

  const isSelf = user.userId === id;
  const isSuper = user.role === "superadmin";
  if (!isSuper && !isSelf) {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Partial<Pick<import("@/lib/admin-store").Admin, "username" | "password" | "role" | "balance">> = {};

  if (body.username !== undefined) {
    if (!isSuper) return NextResponse.json({ error: "تنها سوپرادمین می‌تواند نام کاربری را تغییر دهد" }, { status: 403 });
    updates.username = body.username;
  }
  if (body.password !== undefined) {
    if (body.password.length < 4) return NextResponse.json({ error: "رمز حداقل ۴ کاراکتر" }, { status: 400 });
    updates.password = body.password;
  }
  if (body.role !== undefined) {
    if (!isSuper || isSelf) return NextResponse.json({ error: "نمی‌توانید نقش خود را تغییر دهید" }, { status: 403 });
    updates.role = body.role === "superadmin" ? "superadmin" : "customer";
  }
  if (body.balance !== undefined) {
    if (!isSuper) return NextResponse.json({ error: "تنها سوپرادمین می‌تواند موجودی را تغییر دهد" }, { status: 403 });
    updates.balance = body.balance;
  }

  try {
    const updated = await updateAdmin(id, updates);
    await addLog("update_admin", `ادمین "${updated.username}" بروزرسانی شد`);
    if (body.balance !== undefined && body.balance !== target.balance) {
      const diff = body.balance - target.balance;
      const desc = diff >= 0
        ? `افزایش موجودی "${updated.username}" به میزان ${diff.toLocaleString()} تومان`
        : `کاهش موجودی "${updated.username}" به میزان ${Math.abs(diff).toLocaleString()} تومان`;
      await addTransaction({
        adminId: id, adminUsername: updated.username,
        type: "adjustment", amount: diff,
        balanceBefore: target.balance, balanceAfter: body.balance,
        description: desc,
      });
    }
    const { password: _, ...rest } = updated;
    return NextResponse.json(rest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "خطا" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }

  const { id } = await params;
  if (user.userId === id) {
    return NextResponse.json({ error: "نمی‌توانید خود را حذف کنید" }, { status: 400 });
  }

  const target = getAdminById(id);
  if (!target) return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });

  try {
    await deleteAdmin(id);
    await addLog("delete_admin", `ادمین "${target.username}" حذف شد`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "خطا" }, { status: 500 });
  }
}
