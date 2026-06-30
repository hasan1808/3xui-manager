import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { url, username, password } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });
  try {
    const baseUrl = url.replace(/\/+$/, "");

    // Try to login first (if credentials provided), then check status
    if (username && password) {
      const loginRes = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(10000),
      });
      const cookies = loginRes.headers.get("set-cookie");
      if (loginRes.ok && cookies) {
        const statusRes = await fetch(`${baseUrl}/panel/api/server/status`, {
          headers: { Cookie: cookies },
          signal: AbortSignal.timeout(10000),
        });
        if (statusRes.ok) {
          const data = await statusRes.json();
          const ver = data?.obj?.xray?.version || "";
          return NextResponse.json({ ok: true, msg: `اتصال موفق - Xray: ${ver}` });
        }
        return NextResponse.json({ ok: true, msg: "ورود موفق (دریافت وضعیت ممکن نشد)" });
      }
      return NextResponse.json({ ok: false, msg: "خطا در ورود به پنل" });
    }

    // No credentials: just check if server responds
    const res = await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) return NextResponse.json({ ok: true, msg: "سرور قابل دسترسی است" });
    return NextResponse.json({ ok: false, msg: `HTTP ${res.status}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, msg: e?.message || "عدم اتصال" });
  }
}
