import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { setClientPrice } from "@/lib/client-pricing-store";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmin" }, { status: 403 });
  }

  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected array" }, { status: 400 });
  }

  let imported = 0;
  const errors: string[] = [];

  for (const row of body) {
    const panelId = row.panelId;
    const adminUsername = row.adminUsername || row.clientEmail;
    const pricePerGb = parseInt(row.pricePerGb);

    if (!panelId || !adminUsername || isNaN(pricePerGb) || pricePerGb < 0) {
      errors.push(`Invalid row: ${JSON.stringify(row)}`);
      continue;
    }

    try {
      await setClientPrice(panelId, adminUsername, pricePerGb);
      imported++;
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  return NextResponse.json({ ok: true, imported, errors });
}