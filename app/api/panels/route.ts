import { NextResponse } from "next/server";
import { getAllPanels, addPanel, reorderPanels } from "@/lib/panel-store";
import { requireAuth } from "@/lib/auth-api";
import { addLog } from "@/lib/log-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const panels = getAllPanels().map(({ password, ...p }) => p);
  return NextResponse.json(panels);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const body = await req.json();
  const panel = await addPanel(body);
  await addLog("add_panel", `پنل "${panel.name}" اضافه شد`);
  const { password, ...safe } = panel;
  return NextResponse.json(safe, { status: 201 });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (await reorderPanels(ids)) {
    await addLog("reorder_panels", `ترتیب ${ids.length} پنل تغییر کرد`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Reorder failed" }, { status: 400 });
}
