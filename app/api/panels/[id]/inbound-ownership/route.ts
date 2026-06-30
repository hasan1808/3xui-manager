import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getPanel } from "@/lib/panel-store";
import { assignInbound, unassignInbound, getPanelAssignments } from "@/lib/inbound-ownership-store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user?.role === "superadmin" || (panel && user && panel.ownerId === user.userId)) {
    return NextResponse.json(getPanelAssignments(id));
  }
  return NextResponse.json(getPanelAssignments(id).filter((a) => a.assignedTo === user?.userId));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (user?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { inboundId, adminId } = await req.json();
  if (!inboundId || !adminId) {
    return NextResponse.json({ error: "inboundId and adminId required" }, { status: 400 });
  }

  await assignInbound(id, inboundId, adminId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (user?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const { inboundId, adminId } = await req.json();
  if (!inboundId || !adminId) return NextResponse.json({ error: "inboundId and adminId required" }, { status: 400 });

  await unassignInbound(id, inboundId, adminId);
  return NextResponse.json({ ok: true });
}
