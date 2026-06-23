import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { requireAuth } from "@/lib/auth-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  try {
    const client = getXuiClient(panel);
    await client.ensureLogin(panel.username, panel.password);
    const data = await client.proxyPost("/panel/api/inbounds/lastOnline", {});
    const obj = data?.obj || {};
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    const onlineEmails = Object.keys(obj).filter((email) => {
      const ts = obj[email];
      return ts > 0 && (now - ts) < twoMinutes;
    });
    return NextResponse.json({ count: onlineEmails.length, clients: onlineEmails });
  } catch (e: any) {
    return NextResponse.json({ count: 0, clients: [], error: e.message });
  }
}
