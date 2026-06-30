import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getTrafficHistory } from "@/lib/traffic-history-store";
import { getAllPanels } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { recordTrafficSnapshot } from "@/lib/traffic-history-store";
import { getAssignedInbounds } from "@/lib/inbound-ownership-store";

function filterByAllowed(history: { date: string; panelId: string; totalUp: number; totalDown: number }[], allowedIds: Set<string>) {
  return history.filter((h) => allowedIds.has(h.panelId));
}

function toDaily(data: { date: string; totalUp: number; totalDown: number }[]) {
  const byDate = new Map<string, { totalUp: number; totalDown: number }>();
  for (const h of data) {
    const existing = byDate.get(h.date) || { totalUp: 0, totalDown: 0 };
    existing.totalUp += h.totalUp;
    existing.totalDown += h.totalDown;
    byDate.set(h.date, existing);
  }
  return Array.from(byDate.entries())
    .map(([date, vals]) => ({
      date,
      totalUp: vals.totalUp,
      totalDown: vals.totalDown,
      totalGb: Math.round(((vals.totalUp + vals.totalDown) / (1024 * 1024 * 1024)) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function toWeekly(data: { date: string; totalUp: number; totalDown: number }[], weeks: number) {
  const daily = toDaily(data).slice(-weeks * 7);
  const byWeek = new Map<string, { totalUp: number; totalDown: number }>();
  for (const d of daily) {
    const date = new Date(d.date);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    const existing = byWeek.get(weekKey) || { totalUp: 0, totalDown: 0 };
    existing.totalUp += d.totalUp;
    existing.totalDown += d.totalDown;
    byWeek.set(weekKey, existing);
  }
  return Array.from(byWeek.entries())
    .map(([weekStart, vals]) => ({
      weekStart,
      totalUp: vals.totalUp,
      totalDown: vals.totalDown,
      totalGb: Math.round(((vals.totalUp + vals.totalDown) / (1024 * 1024 * 1024)) * 100) / 100,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "daily";
  const days = parseInt(url.searchParams.get("days") || "30");

  const panels = getAllPanels();
  const allowedPanelIds = new Set(
    user?.role === "superadmin"
      ? panels.map((p) => p.id)
      : panels.filter((p) => {
          if (p.ownerId === user?.userId) return true;
          return getAssignedInbounds(p.id, user!.userId).length > 0;
        }).map((p) => p.id)
  );

  const raw = filterByAllowed(getTrafficHistory(days), allowedPanelIds);

  if (range === "weekly") {
    return NextResponse.json(toWeekly(raw, Math.ceil(days / 7)));
  }
  if (range === "raw") {
    return NextResponse.json(raw);
  }
  return NextResponse.json(toDaily(raw));
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const panels = getAllPanels();
  let recorded = 0;
  for (const panel of panels) {
    try {
      const client = getXuiClient(panel);
      await client.ensureLogin(panel.username, panel.password);
      const inbounds = await client.getInbounds();
      let totalUp = 0, totalDown = 0, clientCount = 0;
      for (const inb of inbounds) {
        totalUp += (inb.up || 0);
        totalDown += (inb.down || 0);
        try {
          const settings = typeof (inb as any).settings === "string" ? JSON.parse((inb as any).settings) : ((inb as any).settings || {});
          clientCount += settings?.clients?.length || 0;
        } catch {}
      }
      let onlineCount = 0;
      try {
        const onlines = await client.getOnlineClients();
        onlineCount = onlines.length;
      } catch {}
      await recordTrafficSnapshot(panel.id, panel.name, totalUp, totalDown, clientCount, onlineCount);
      recorded++;
    } catch {}
  }
  return NextResponse.json({ ok: true, recorded });
}
