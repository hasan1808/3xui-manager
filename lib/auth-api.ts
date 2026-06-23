import { NextResponse } from "next/server";
import { verifyToken } from "./jwt";

export async function requireAuth(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await verifyToken(match[1]);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  return null; // authenticated
}
