import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getPricing, setPricing } from "@/lib/finance-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  return NextResponse.json(getPricing());
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  const body = await req.json();
  const updates: Partial<import("@/lib/finance-store").PricingConfig> = {};
  if (body.pricePerGb !== undefined) {
    const v = Number(body.pricePerGb);
    if (v < 0) return NextResponse.json({ error: "قیمت نمی‌تواند منفی باشد" }, { status: 400 });
    updates.pricePerGb = v;
  }
  if (body.currency !== undefined) updates.currency = body.currency;
  const saved = await setPricing(updates);
  return NextResponse.json(saved);
}
