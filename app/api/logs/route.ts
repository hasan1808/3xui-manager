import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { addLog, getLogs, clearLogs } from "@/lib/log-store";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") || "50")));
  const search = req.nextUrl.searchParams.get("search") || "";
  let logs = getLogs(limit || 5000);
  if (user && user.role !== "superadmin") {
    logs = logs.filter((l: any) => l.detail?.includes(user.username));
  }
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter((l) => l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q));
  }
  const total = logs.length;
  const paged = logs.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({ items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
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
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
  clearLogs();
  return NextResponse.json({ ok: true });
}
