import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getTransactions } from "@/lib/finance-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const adminId = url.searchParams.get("adminId");
  const type = url.searchParams.get("type");
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50")));

  let all = getTransactions();

  if (user.role !== "superadmin") {
    all = all.filter((t) => t.adminId === user.userId);
  }
  if (adminId) all = all.filter((t) => t.adminId === adminId);
  if (type) all = all.filter((t) => t.type === type);
  if (fromDate) all = all.filter((t) => t.createdAt >= fromDate);
  if (toDate) all = all.filter((t) => t.createdAt <= toDate + "T23:59:59.999Z");
  if (search) {
    const q = search.toLowerCase();
    all = all.filter((t) => t.description.toLowerCase().includes(q) || t.adminUsername.toLowerCase().includes(q));
  }

  const total = all.length;
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({ items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
