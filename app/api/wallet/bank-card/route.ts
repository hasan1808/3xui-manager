import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getBankCards, addBankCard, deleteBankCard } from "@/lib/bank-card-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  return NextResponse.json(getBankCards());
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
  const { cardNumber, bankName, accountHolder, shaba } = await req.json();
  if (!cardNumber || !bankName || !accountHolder) {
    return NextResponse.json({ error: "شماره کارت، بانک و صاحب حساب الزامی است" }, { status: 400 });
  }
  const card = await addBankCard({ cardNumber, bankName, accountHolder, shaba });
  return NextResponse.json(card, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "شناسه کارت الزامی است" }, { status: 400 });
  await deleteBankCard(id);
  return NextResponse.json({ ok: true });
}
