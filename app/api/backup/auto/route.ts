import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { readSettings, writeSettings } from "@/lib/settings-store";
import { startAutoBackup, stopAutoBackup, getAutoBackupStatus, triggerAutoBackup } from "@/lib/auto-backup";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const settings = readSettings();
  return NextResponse.json({
    enabled: settings.autoBackup,
    intervalHours: settings.autoBackupInterval,
    active: settings.autoBackup,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { action, enabled, intervalHours } = body;

  if (action === "trigger") {
    triggerAutoBackup();
    return NextResponse.json({ ok: true, message: "بکاپ شروع شد" });
  }

  const updates: Record<string, any> = {};
  if (typeof enabled === "boolean") updates.autoBackup = enabled;
  if (typeof intervalHours === "number") updates.autoBackupInterval = intervalHours;

  if (Object.keys(updates).length > 0) {
    const settings = await writeSettings(updates);
    if (settings.autoBackup) {
      startAutoBackup(settings.autoBackupInterval);
    } else {
      stopAutoBackup();
    }
    return NextResponse.json({ ok: true, enabled: settings.autoBackup, intervalHours: settings.autoBackupInterval });
  }

  return NextResponse.json({ error: "پارامتر نامعتبر" }, { status: 400 });
}
