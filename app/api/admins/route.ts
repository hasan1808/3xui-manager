import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAdmins, addAdmin } from "@/lib/admin-store";
import { addLog } from "@/lib/log-store";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  const admins = getAdmins().map(({ password, ...rest }) => rest);
  return NextResponse.json(admins);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const rl = rateLimitMiddleware("create-admin", 5);
  const { passed, response } = rl(req);
  if (!passed) return response;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  }
  const { username, password, role } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "نام کاربری و رمز الزامی است" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "رمز حداقل ۴ کاراکتر" }, { status: 400 });
  }
  try {
    const admin = await addAdmin(username, password, role === "superadmin" ? "superadmin" : "customer", user.userId);
    await addLog("add_admin", `ادمین "${username}" اضافه شد`);
    const { password: _, ...rest } = admin;
    return NextResponse.json(rest, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "خطا" }, { status: 400 });
  }
}
