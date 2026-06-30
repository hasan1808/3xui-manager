import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { createRequest, getRequestsByAdmin, getPendingRequests, resolveRequest } from "@/lib/wallet-request-store";
import { getAdminById, updateAdmin } from "@/lib/admin-store";
import { addTransaction } from "@/lib/finance-store";
import { addLog } from "@/lib/log-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "superadmin") {
    return NextResponse.json(getPendingRequests());
  }
  return NextResponse.json(getRequestsByAdmin(user.userId));
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, description, receipt } = await req.json();
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "مبلغ نامعتبر" }, { status: 400 });
  }

  const request = createRequest(user.userId, user.username, amount, description || "درخواست شارژ", receipt);
  await addLog("wallet_request", `${user.username} درخواست شارژ ${amount.toLocaleString()} تومان ایجاد کرد`);
  return NextResponse.json(request, { status: 201 });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  const { requestId, action } = await req.json();
  if (!requestId || !["approved", "rejected"].includes(action)) {
    return NextResponse.json({ error: "پارامتر نامعتبر" }, { status: 400 });
  }

  const request = await resolveRequest(requestId, action, user.userId);
  if (!request) {
    return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  }

  if (action === "approved") {
    const admin = await getAdminById(request.adminId);
    if (admin) {
      const newBalance = (admin.balance || 0) + request.amount;
      await updateAdmin(request.adminId, { balance: newBalance });
      await addTransaction({
        adminId: request.adminId,
        adminUsername: request.adminUsername,
        type: "deposit",
        amount: request.amount,
        balanceBefore: admin.balance || 0,
        balanceAfter: newBalance,
        description: `شارژ کیف‌پول - درخواست ${requestId.slice(0, 8)}`,
      });
      await addLog("wallet_topup", `شارژ ${request.amount.toLocaleString()} تومان به کیف‌پول ${request.adminUsername} اضافه شد`);
    }
  }

  return NextResponse.json(request);
}
