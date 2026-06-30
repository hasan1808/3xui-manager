import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllClientPrices } from "@/lib/client-pricing-store";
import { getAllPanels } from "@/lib/panel-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prices = getAllClientPrices();
  const panels = getAllPanels();

  const header = "panelId,panelName,adminUsername,pricePerGb";
  const rows = prices.map((p) => {
    const panel = panels.find((pl) => pl.id === p.panelId);
    return `"${p.panelId}","${panel?.name || ""}","${p.adminUsername}","${p.pricePerGb}"`;
  });

  const csv = [header, ...rows].join("\n");
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-pricing-export.csv"`,
    },
  });
}