import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getAllPanels, getPanel } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { listPanelBackups, savePanelBackupBinary, readPanelBackupBinary, deletePanelBackup, getPanelBackupInfo } from "@/lib/backup-store";
import { addLog } from "@/lib/log-store";
import type { Panel } from "@/lib/types";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  const { searchParams } = new URL(req.url);
  const panelId = searchParams.get("panelId");
  const file = searchParams.get("file");
  const download = searchParams.get("download");

  if (file && download) {
    if (user && user.role !== "superadmin") {
      const backups = listPanelBackups();
      const backup = backups.find((b: any) => b.filename === file || b.file === file);
      if (!backup || !getAllPanels().some((p) => p.ownerId === user.userId && p.id === backup.panelId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
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

  let list = listPanelBackups(panelId || undefined);
  if (user && user.role !== "superadmin") {
    const ownedPanels = getAllPanels().filter((p) => p.ownerId === user.userId).map((p) => p.id);
    list = list.filter((b) => ownedPanels.includes(b.panelId));
  }
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  try {
    const body = await req.json().catch(() => ({}));
    const panelId = body.panelId;

    let panels = panelId ? [getPanel(panelId)].filter(Boolean) as Panel[] : getAllPanels();
    if (user && user.role !== "superadmin") {
      panels = panels.filter((p) => p.ownerId === user.userId);
    }
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
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
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
