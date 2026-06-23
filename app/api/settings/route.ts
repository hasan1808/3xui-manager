import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { readSettings, writeSettings, type AppSettings } from "@/lib/settings-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const settings = readSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const body = await req.json();
  const allowedKeys: (keyof AppSettings)[] = [
    "theme",
    "dashboardRefreshInterval",
    "autoBackup",
    "autoBackupInterval",
    "toastDuration",
    "panelTimeout",
    "panelRetryAttempts",
    "compactSidebar",
  ];
  const updates: Partial<AppSettings> = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }
  const settings = await writeSettings(updates);
  return NextResponse.json(settings);
}
