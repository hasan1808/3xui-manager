import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { getSystemBackup, restoreSystemBackup } from "@/lib/backup-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const data = getSystemBackup();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="3xui-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const result = await restoreSystemBackup(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}
