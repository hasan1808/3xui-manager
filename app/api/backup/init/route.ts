import { NextResponse } from "next/server";
import { initAutoBackupIfNeeded, getAutoBackupStatus } from "@/lib/auto-backup";

export async function GET() {
  initAutoBackupIfNeeded();
  return NextResponse.json(getAutoBackupStatus());
}
