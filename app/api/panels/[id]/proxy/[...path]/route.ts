import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { proxyPanelRequest } from "@/lib/xui-api";
import { requireAuth } from "@/lib/auth-api";

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
  const { id, path } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  try {
    const body = await req.json().catch(() => null);
    const data = await proxyPanelRequest(panel, "POST", "/" + path.join("/"), body || undefined);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
