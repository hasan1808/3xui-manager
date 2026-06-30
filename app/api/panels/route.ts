import { NextResponse } from "next/server";
import { getAllPanels, addPanel, reorderPanels } from "@/lib/panel-store";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { addLog } from "@/lib/log-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  let panels = getAllPanels();
  return NextResponse.json(panels.map(({ password, ...p }) => p));
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const body = await req.json();
  if (user && user.role !== "superadmin") {
    body.ownerId = user.userId;
  }
  const panel = await addPanel(body);
  await addLog("add_panel", `پنل "${panel.name}" اضافه شد`);
  const { password, ...safe } = panel;
  return NextResponse.json(safe, { status: 201 });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (user && user.role !== "superadmin") {
    const allPanels = getAllPanels();
    const ownedIds = allPanels.filter((p) => p.ownerId === user.userId).map((p) => p.id);
    const hasForeign = ids.some((id: string) => !ownedIds.includes(id));
    if (hasForeign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (await reorderPanels(ids)) {
    await addLog("reorder_panels", `ترتیب ${ids.length} پنل تغییر کرد`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Reorder failed" }, { status: 400 });
}
