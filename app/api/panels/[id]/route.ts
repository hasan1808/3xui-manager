import { NextResponse } from "next/server";
import { getPanel, updatePanel, deletePanel } from "@/lib/panel-store";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { clearClientCache } from "@/lib/xui-api";
import { addLog } from "@/lib/log-store";
import { removePanelLinks } from "@/lib/client-links-store";

function isOwner(panel: ReturnType<typeof getPanel>, userId: string, role: string): boolean {
  if (!panel) return false;
  if (role === "superadmin") return true;
  return panel.ownerId === userId;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
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
  const user = await getAuthUser(req);
  const { id } = await params;
  const panel = getPanel(id);
  if (panel && user && !isOwner(panel, user.userId, user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const allowed = ["name", "url", "username", "password", "apiToken", "active", "pricePerGb", "subUri", "clientUrl"];
  if (user?.role === "superadmin") allowed.push("ownerId");
  const filtered: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) filtered[key] = body[key];
  }
  const updated = await updatePanel(id, filtered);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearClientCache(id);
  await addLog("edit_panel", `پنل "${updated.name}" ویرایش شد`);
  const { password, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id } = await params;
  const panel = getPanel(id);
  if (panel && user && !isOwner(panel, user.userId, user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const name = panel?.name || id;
  const ok = await deletePanel(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  clearClientCache(id);
  await removePanelLinks(id);
  await addLog("delete_panel", `پنل "${name}" حذف شد`);
  return NextResponse.json({ ok: true });
}
