import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAdmins, getAdminById, updateAdmin } from "@/lib/admin-store";
import { addTransaction, getPricing } from "@/lib/finance-store";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmin" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { adminId, amount, description } = body;

  if (!adminId || amount == null) {
    return NextResponse.json({ error: "adminId and amount required" }, { status: 400 });
  }

  const target = getAdminById(adminId);
  if (!target) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  const deductAmount = Math.abs(amount);
  if (target.balance < deductAmount) {
    return NextResponse.json({ error: "موجودی کافی نیست" }, { status: 400 });
  }

  const newBalance = target.balance - deductAmount;
  await updateAdmin(adminId, { balance: newBalance });
  await addTransaction({
    adminId,
    adminUsername: target.username,
    type: "usage",
    amount: -deductAmount,
    balanceBefore: target.balance,
    balanceAfter: newBalance,
    description: description || `کسری بابت مصرف ترافیک (${deductAmount.toLocaleString()} تومان)`,
  });

  return NextResponse.json({ ok: true, balanceBefore: target.balance, balanceAfter: newBalance });
}