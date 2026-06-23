import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { requireAuth } from "@/lib/auth-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  try {
    const client = getXuiClient(panel);
    await client.ensureLogin(panel.username, panel.password);
    const raw = await client.getSettingAll();
    const settings: Record<string, string> = {};
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item.key && item.value !== undefined) settings[item.key] = item.value;
      }
    } else if (typeof raw === "object") {
      Object.assign(settings, raw);
    }
    return NextResponse.json({ obj: settings });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
