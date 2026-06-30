import { NextResponse } from "next/server";
import { verifyToken, type JwtPayload } from "./jwt";

function getExpectedOrigin(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

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
  return null;
}

export async function requireAuthCsrf(req: Request) {
  const r = await requireAuth(req);
  if (r) return r;
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (origin || referer) {
      const expected = getExpectedOrigin(req);
      const actual = origin || referer || "";
      if (!actual.startsWith(expected)) {
        return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
      }
    }
  }
  return null;
}

export async function getAuthUser(req: Request): Promise<JwtPayload | null> {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}
