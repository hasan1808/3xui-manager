import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.SSL_ENABLED === "true") {
    const proto = req.headers.get("x-forwarded-proto");
    const host = req.headers.get("host");
    if (proto === "http" && host) {
      const url = req.nextUrl.clone();
      url.protocol = "https:";
      url.host = host;
      return NextResponse.redirect(url);
    }
  }

  const { pathname } = req.nextUrl;
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
