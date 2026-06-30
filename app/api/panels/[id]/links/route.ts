import { NextResponse } from "next/server";
import { getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { setClientLink, setSubUrl, getPanelLinks, getSubUrl } from "@/lib/client-links-store";
import { requireAuth, getAuthUser } from "@/lib/auth-api";

function parseClients(inb: any): any[] {
  try {
    const s = typeof inb.settings === "string" ? JSON.parse(inb.settings) : inb.settings;
    return s?.clients || [];
  } catch { return []; }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  const links = getPanelLinks(id);
  const subUrls: Record<string, string> = {};
  for (const l of links) {
    for (const subLink of l.subLinks) {
      try {
        const url = new URL(subLink);
        const subId = url.pathname.split("/").filter(Boolean).pop() || "";
        if (subId && !subUrls[subId]) subUrls[subId] = getSubUrl(id, subId);
      } catch {}
    }
  }

  return NextResponse.json({ links, subUrls });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { id } = await params;
  const panel = getPanel(id);
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  if (user && user.role !== "superadmin" && panel.ownerId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const errors: string[] = [];
  let count = 0;

  try {
    const client = getXuiClient(panel);
    await client.ensureLogin(panel.username, panel.password);

    const inboundsData = await client.proxyGet("/panel/api/inbounds/list");
    const inbounds = inboundsData.obj || [];

    for (const inb of inbounds) {
      const clients = parseClients(inb);
      for (const cl of clients) {
        try {
          const configLink = await client.getClientLinks(inb.id, cl.email);
          if (!configLink) {
            errors.push(`${cl.email}: empty response from getClientLinks`);
            continue;
          }
          let subLinks: string[] = [];
          if (cl.subId) {
            try {
              subLinks = await client.getSubLinks(cl.subId);
            } catch (e: any) {
              errors.push(`${cl.email} subLinks: ${e.message}`);
            }
          }
          await setClientLink(id, inb.id, cl.email, configLink, subLinks);
          count++;
        } catch (e: any) {
          errors.push(`${cl.email}: ${e.message}`);
        }
      }
      if (clients.length > 0) {
        const subId = clients[0].subId;
        if (subId) {
          try {
            const settings = await client.getSettingAll();
            if (settings.SubEnable !== false) {
              const baseUrl = panel.clientUrl || panel.url;
              const h = new URL(baseUrl).hostname;
              const subUri = settings.SubUri || "";
              const subUrl = subUri
                ? `${subUri.replace(/\/+$/, "")}/${subId}`
                : panel.clientUrl
                  ? `${panel.clientUrl.replace(/\/+$/, "")}/${subId}`
                  : `${baseUrl.startsWith("https") ? "https" : "http"}://${h}:${settings.SubPort || 2096}${settings.SubPath || "/sub/"}${subId}`;
              await setSubUrl(id, subId, subUrl);
            }
          } catch (e: any) {
            errors.push(`subUrl: ${e.message}`);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, count, errors: errors.length > 0 ? errors : undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, errors }, { status: 502 });
  }
}
