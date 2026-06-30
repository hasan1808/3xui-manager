import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAdminById } from "@/lib/admin-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminById(user.userId);
  if (!admin) return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });

  const { password, ...rest } = admin;
  return NextResponse.json(rest);
}
