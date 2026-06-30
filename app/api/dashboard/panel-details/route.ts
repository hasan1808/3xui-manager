import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { getAssignedInbounds } from "@/lib/inbound-ownership-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const panelId = url.searchParams.get("panelId");
  if (!panelId) return NextResponse.json({ error: "panelId required" }, { status: 400 });

  const panel = getPanel(panelId);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  const isSuper = user.role === "superadmin";
  const allowedInboundIds = isSuper ? null : getAssignedInbounds(panelId, user.userId);

  try {
    const client = getXuiClient(panel);
    await client.ensureLogin(panel.username, panel.password);
    const inbounds: any[] = await client.getInbounds();

    let totalUp = 0, totalDown = 0, clientCount = 0, onlineCount = 0;

    for (const inb of inbounds) {
      if (allowedInboundIds && !allowedInboundIds.includes(inb.id)) continue;
      totalUp += inb.up || 0;
      totalDown += inb.down || 0;
      try {
        const settings = typeof inb.settings === "string" ? JSON.parse(inb.settings) : (inb.settings || {});
        clientCount += settings?.clients?.length || 0;
      } catch {}
    }

    try {
      const lastOnlineMap = await client.getLastOnline();
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      const onlineEmails = new Set(
        Object.entries(lastOnlineMap)
          .filter(([, ts]) => ts > 0 && (now - ts) < twoMinutes)
          .map(([email]) => email)
      );
      for (const inb of inbounds) {
        if (allowedInboundIds && !allowedInboundIds.includes(inb.id)) continue;
        try {
          const settings = typeof inb.settings === "string" ? JSON.parse(inb.settings) : (inb.settings || {});
          for (const c of settings?.clients || []) {
            if (onlineEmails.has(c.email)) onlineCount++;
          }
        } catch {}
      }
    } catch {}

    return NextResponse.json({ totalUp, totalDown, clientCount, onlineCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
