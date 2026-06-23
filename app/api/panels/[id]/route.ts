import { NextResponse } from "next/server";
import { getPanel, updatePanel, deletePanel } from "@/lib/panel-store";
import { requireAuth } from "@/lib/auth-api";
import { clearClientCache } from "@/lib/xui-api";
import { addLog } from "@/lib/log-store";
import { removePanelLinks } from "@/lib/client-links-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { password, ...safe } = panel;
  return NextResponse.json(safe);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const body = await req.json();
  const panel = await updatePanel(id, body);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearClientCache(id);
  await addLog("edit_panel", `پنل "${panel.name}" ویرایش شد`);
  const { password, ...safe } = panel;
  return NextResponse.json(safe);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  const name = panel?.name || id;
  const ok = await deletePanel(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearClientCache(id);
  await removePanelLinks(id);
  await addLog("delete_panel", `پنل "${name}" حذف شد`);
  return NextResponse.json({ ok: true });
}
