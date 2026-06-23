import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { addLog, getLogs, clearLogs } from "@/lib/log-store";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
  return NextResponse.json(getLogs(limit));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { action, detail } = await req.json();
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });
  await addLog(action, detail);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  clearLogs();
  return NextResponse.json({ ok: true });
}
