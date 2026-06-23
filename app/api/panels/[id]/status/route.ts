import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { fetchPanelStatus } from "@/lib/xui-api";
import { requireAuth } from "@/lib/auth-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const status = await fetchPanelStatus(panel);
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
