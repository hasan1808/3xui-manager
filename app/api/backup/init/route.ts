import { NextResponse } from "next/server";
import { initAutoBackupIfNeeded, getAutoBackupStatus } from "@/lib/auto-backup";
import { requireAuth } from "@/lib/auth-api";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  initAutoBackupIfNeeded();
  return NextResponse.json(getAutoBackupStatus());
}
