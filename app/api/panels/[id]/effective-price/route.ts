import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { resolvePrice } from "@/lib/client-pricing-store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id } = await params;
  const price = resolvePrice(id, user?.username);
  return NextResponse.json({ pricePerGb: price });
}
