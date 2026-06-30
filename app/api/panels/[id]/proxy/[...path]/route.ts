import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { proxyPanelRequest } from "@/lib/xui-api";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAssignedInbounds } from "@/lib/inbound-ownership-store";

function isOwner(panel: ReturnType<typeof getPanel>, userId: string, role: string): boolean {
  if (!panel) return false;
  if (role === "superadmin") return true;
  return panel.ownerId === userId;
}

function extractInboundId(path: string[]): number | null {
  for (let i = 0; i < path.length; i++) {
    if (path[i] === "update" && i + 1 < path.length) {
      const n = parseInt(path[i + 1], 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id, path } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  try {
    const data = await proxyPanelRequest(panel, "GET", "/" + path.join("/"));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id, path } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  if (user && !isOwner(panel, user.userId, user.role)) {
    const inboundId = extractInboundId(path);
    const assigned = inboundId !== null ? getAssignedInbounds(id, user.userId).includes(inboundId) : false;
    if (!assigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  try {
    const body = await req.json().catch(() => null);
    const data = await proxyPanelRequest(panel, "POST", "/" + path.join("/"), body || undefined);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
