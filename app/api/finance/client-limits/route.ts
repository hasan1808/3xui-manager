import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllLimits, setClientLimit, deleteClientLimit, getLimitsWithTraffic, getAllMonthlyTraffic, recordClientTraffic } from "@/lib/client-limits-store";
import { getAllPanels, getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { addLog } from "@/lib/log-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "traffic") {
    return NextResponse.json(getAllMonthlyTraffic());
  }
  if (action === "with-traffic") {
    return NextResponse.json(getLimitsWithTraffic());
  }
  return NextResponse.json(getAllLimits());
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const body = await req.json();

  if (body.action === "sync-traffic") {
    const panels = getAllPanels();
    let synced = 0;
    for (const panel of panels) {
      try {
        const client = getXuiClient(panel);
        await client.ensureLogin(panel.username, panel.password);
        const inbounds = await client.getInbounds();
        for (const inb of inbounds) {
          try {
            const raw: any = inb;
            const settings = typeof raw.settings === "string" ? JSON.parse(raw.settings) : (raw.settings || {});
            const clients = settings?.clients || [];
            for (const c of clients) {
              const up = c.up || 0;
              const down = c.down || 0;
              if (c.email && (up + down) > 0) {
                recordClientTraffic(panel.id, c.email, up, down);
                synced++;
              }
            }
          } catch {}
        }
      } catch {}
    }
    await addLog("sync_traffic", `همگام‌سازی ترافیک: ${synced} کاربر از ${panels.length} پنل`);
    return NextResponse.json({ ok: true, synced });
  }

  if (body.action === "enforce") {
    const limits = getAllLimits();
    const panels = getAllPanels();
    const now = new Date();
    let disabled = 0;
    const messages: string[] = [];

    for (const limit of limits) {
      const panel = panels.find((p) => p.id === limit.panelId);
      if (!panel) continue;

      let shouldDisable = false;
      let reason = "";

      if (limit.expiryDate) {
        const expiry = new Date(limit.expiryDate);
        if (now > expiry) {
          shouldDisable = true;
          reason = "تاریخ انقضا";
        }
      }

      if (limit.monthlyTrafficLimitGb != null) {
        const found = getLimitsWithTraffic().find((l) => l.panelId === limit.panelId && l.clientEmail === limit.clientEmail);
        const trafficGb = found && "trafficGb" in found ? found.trafficGb : 0;
        if (trafficGb >= limit.monthlyTrafficLimitGb) {
          shouldDisable = true;
          reason = "سقف ترافیک";
        }
      }

      if (shouldDisable) {
        try {
          const client = getXuiClient(panel);
          await client.ensureLogin(panel.username, panel.password);
          const inbounds = await client.getInbounds();
          for (const inb of inbounds) {
            try {
              const raw: any = inb;
              const settings = typeof raw.settings === "string" ? JSON.parse(raw.settings) : (raw.settings || {});
              const clients = settings?.clients || [];
              const idx = clients.findIndex((c: any) => c.email === limit.clientEmail);
              if (idx >= 0 && clients[idx].enable) {
                clients[idx].enable = false;
                raw.settings = JSON.stringify(settings);
                await client.proxyPost(`/panel/api/inbounds/update/${inb.id}`, raw);
                disabled++;
                messages.push(`${limit.clientEmail} (${reason})`);
                break;
              }
            } catch {}
          }
        } catch {}
      }
    }

    if (disabled > 0) {
      await addLog("enforce_limits", `غیرفعال‌سازی خودکار: ${messages.join(", ")}`);
    }
    return NextResponse.json({ ok: true, disabled, messages });
  }

  const { panelId, clientEmail, groupId, monthlyTrafficLimitGb, expiryDate } = body;
  if (!panelId || !clientEmail) return NextResponse.json({ error: "پنل و ایمیل الزامی است" }, { status: 400 });
  const limit = setClientLimit(panelId, clientEmail, groupId ?? null, monthlyTrafficLimitGb ?? null, expiryDate ?? null);
  return NextResponse.json(limit);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const url = new URL(req.url);
  const panelId = url.searchParams.get("panelId");
  const clientEmail = url.searchParams.get("clientEmail");
  if (!panelId || !clientEmail) return NextResponse.json({ error: "پنل و ایمیل الزامی است" }, { status: 400 });
  const ok = deleteClientLimit(panelId, clientEmail);
  return NextResponse.json({ ok });
}
