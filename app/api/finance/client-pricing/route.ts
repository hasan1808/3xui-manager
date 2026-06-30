import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllClientPrices, setClientPrice, removeClientPrice, resolvePrice } from "@/lib/client-pricing-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  return NextResponse.json(getAllClientPrices());
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  const { panelId, adminUsername, pricePerGb } = await req.json();
  if (!panelId || !adminUsername) {
    return NextResponse.json({ error: "panelId و نام کاربری ادمین الزامی است" }, { status: 400 });
  }
  if (pricePerGb < 0) {
    return NextResponse.json({ error: "قیمت نمی‌تواند منفی باشد" }, { status: 400 });
  }
  const cp = await setClientPrice(panelId, adminUsername, pricePerGb);
  return NextResponse.json(cp, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  const { panelId, adminUsername } = await req.json();
  if (!panelId || !adminUsername) {
    return NextResponse.json({ error: "panelId و نام کاربری ادمین الزامی است" }, { status: 400 });
  }
  await removeClientPrice(panelId, adminUsername);
  return NextResponse.json({ ok: true });
}
