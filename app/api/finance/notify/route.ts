import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getNotificationSettings, setNotificationSettings, sendTelegramMessage } from "@/lib/notification-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = getNotificationSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmin" }, { status: 403 });
  }
  const body = await req.json();
  const updated = await setNotificationSettings(body);
  return NextResponse.json(updated);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const ok = await sendTelegramMessage(body.message || "تست پیام از 3xui-manager");
  return NextResponse.json({ ok });
}