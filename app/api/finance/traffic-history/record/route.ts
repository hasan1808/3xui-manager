import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { getAllPanels } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { recordTrafficSnapshot } from "@/lib/traffic-history-store";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;

  const panels = getAllPanels();
  for (const panel of panels.filter((p) => p.active)) {
    try {
      const client = getXuiClient(panel);
      await client.ensureLogin(panel.username, panel.password);
      const inbounds = await client.getInbounds();
      let totalUp = 0, totalDown = 0, clientCount = 0;
      for (const inb of inbounds) {
        totalUp += inb.up || 0;
        totalDown += inb.down || 0;
        try {
          const raw: any = inb;
          const s = typeof raw.settings === "string" ? JSON.parse(raw.settings) : (raw.settings || {});
          clientCount += s?.clients?.length || 0;
        } catch {}
      }
      let onlineCount = 0;
      try {
        const onlines = await client.getOnlineClients();
        onlineCount = onlines.length;
      } catch {}
      await recordTrafficSnapshot(panel.id, panel.name, totalUp, totalDown, clientCount, onlineCount);
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
