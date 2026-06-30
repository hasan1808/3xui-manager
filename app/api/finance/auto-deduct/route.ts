import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAutoDeductSettings, setAutoDeductSettings, runAutoDeduct, startAutoDeduct, stopAutoDeduct } from "@/lib/auto-deduct-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const settings = getAutoDeductSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const body = await req.json();
  const updates: Record<string, any> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.runHour === "number") updates.runHour = body.runHour;
  if (typeof body.runMinute === "number") updates.runMinute = body.runMinute;

  const settings = await setAutoDeductSettings(updates);
  if (settings.enabled) startAutoDeduct();
  else stopAutoDeduct();
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const result = await runAutoDeduct();
  return NextResponse.json(result);
}
