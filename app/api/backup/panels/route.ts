import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { getAllPanels, getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { listPanelBackups, savePanelBackupBinary, readPanelBackupBinary, deletePanelBackup, getPanelBackupInfo } from "@/lib/backup-store";
import { addLog } from "@/lib/log-store";
import type { Panel } from "@/lib/types";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const { searchParams } = new URL(req.url);
  const panelId = searchParams.get("panelId");
  const file = searchParams.get("file");
  const download = searchParams.get("download");

  if (file && download) {
    const buffer = readPanelBackupBinary(file);
    if (!buffer) return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
    const info = getPanelBackupInfo(file);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${info?.filename || 'backup.db'}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  }

  const list = listPanelBackups(panelId || undefined);
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const panelId = body.panelId;

    const panels = panelId ? [getPanel(panelId)].filter(Boolean) as Panel[] : getAllPanels();
    if (panels.length === 0) {
      return NextResponse.json({ error: "پنلی یافت نشد" }, { status: 404 });
    }

    const results: { panelId: string; panelName: string; ok: boolean; error?: string }[] = [];

    for (const panel of panels) {
      try {
        const client = getXuiClient(panel);
        await client.ensureLogin(panel.username, panel.password);
        const authHeaders = client.getAuthHeaders();
        const res = await fetch(`${client.getBaseUrl()}/panel/api/server/getDb`, {
          headers: authHeaders,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length === 0) throw new Error("فایل خالی دریافت شد");
        const header = buffer.slice(0, 16).toString("ascii");
        if (!header.startsWith("SQLite format")) {
          throw new Error("فایل معتبر SQLite نیست");
        }
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `${ts}.db`;
        savePanelBackupBinary(panel.id, Buffer.from(arrayBuffer), filename);
        results.push({ panelId: panel.id, panelName: panel.name, ok: true });
        await addLog(`بکاپ دیتابیس`, `بکاپ دیتابیس از ${panel.name} گرفته شد`);
      } catch (e: any) {
        results.push({ panelId: panel.id, panelName: panel.name, ok: false, error: e.message });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    await addLog(`پشتیبان‌گیری`, `پشتیبان‌گیری از ${okCount}/${results.length} پنل انجام شد`);
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "فایل مشخص نشده" }, { status: 400 });
    const ok = await deletePanelBackup(file);
    if (!ok) return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
    await addLog(`حذف بکاپ`, `بکاپ ${file} حذف شد`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}
