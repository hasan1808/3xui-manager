import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllPanels } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { getAssignedInbounds } from "@/lib/inbound-ownership-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const panels = getAllPanels();
  const isSuper = user.role === "superadmin";

  let clientCount = 0, totalUp = 0, totalDown = 0, onlineCount = 0, panelsOnline = 0, panelCount = 0;

  for (const panel of panels) {
    let allowedInboundIds: number[] | null = null;
    if (!isSuper) {
      allowedInboundIds = getAssignedInbounds(panel.id, user.userId);
      if (allowedInboundIds.length === 0) continue;
    }

    try {
      const client = getXuiClient(panel);
      await client.ensureLogin(panel.username, panel.password);
      const inbounds: any[] = await client.getInbounds();
      const status = await client.getStatus().catch(() => null);

      let hasAllowed = false;
      for (const inb of inbounds) {
        if (allowedInboundIds && !allowedInboundIds.includes(inb.id)) continue;
        hasAllowed = true;
        totalUp += inb.up || 0;
        totalDown += inb.down || 0;
        try {
          const settings = typeof inb.settings === "string" ? JSON.parse(inb.settings) : (inb.settings || {});
          clientCount += settings?.clients?.length || 0;
        } catch {}
      }

      if (hasAllowed) {
        panelCount++;
        if (status) panelsOnline++;
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
      }
    } catch {}
  }

  return NextResponse.json({ clientCount, totalUp, totalDown, onlineCount, panelsOnline, panelCount });
}
