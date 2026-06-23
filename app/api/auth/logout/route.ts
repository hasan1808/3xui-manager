import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", { httpOnly: true, maxAge: 0 });
  return res;
}
