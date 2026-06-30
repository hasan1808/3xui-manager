import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllGroups, addGroup, updateGroup, deleteGroup } from "@/lib/client-limits-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  return NextResponse.json(getAllGroups());
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const body = await req.json();
  const { name, color, defaultTrafficLimitGb, defaultExpiryDays } = body;
  if (!name) return NextResponse.json({ error: "نام گروه الزامی است" }, { status: 400 });
  const group = addGroup(name, color || "#3b82f6", defaultTrafficLimitGb ?? null, defaultExpiryDays ?? null);
  return NextResponse.json(group);
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "شناسه گروه الزامی است" }, { status: 400 });
  const result = updateGroup(id, updates);
  if (!result) return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "شناسه گروه الزامی است" }, { status: 400 });
  const ok = deleteGroup(id);
  if (!ok) return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
