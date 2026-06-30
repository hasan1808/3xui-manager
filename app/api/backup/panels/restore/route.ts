import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getPanel, getAllPanels } from "@/lib/panel-store";
import { getXuiClient } from "@/lib/xui-api";
import { readPanelBackupBinary } from "@/lib/backup-store";
import { addLog } from "@/lib/log-store";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const panelId = body.panelId;
    const file = body.file;

    if (!panelId || !file) {
      return NextResponse.json({ error: "پنل یا فایل بکاپ مشخص نشده" }, { status: 400 });
    }

    const panel = getPanel(panelId);
    if (!panel) {
      return NextResponse.json({ error: "پنل یافت نشد" }, { status: 404 });
    }

    const buffer = readPanelBackupBinary(file);
    if (!buffer) {
      return NextResponse.json({ error: "فایل بکاپ یافت نشد", status: 404 });
    }
    if (buffer.length === 0) {
      return NextResponse.json({ error: "فایل بکاپ خالی است", status: 400 });
    }
    const header = buffer.slice(0, 16).toString("ascii");
    if (!header.startsWith("SQLite format")) {
      return NextResponse.json({ error: "فایل بکاپ معتبر SQLite نیست", status: 400 });
    }

    const client = getXuiClient(panel);
    await client.ensureLogin(panel.username, panel.password);
    const authHeaders = client.getAuthHeaders();
    const filename = require("path").basename(file);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" });
    formData.append("file", blob, filename);

    const res = await fetch(`${client.getBaseUrl()}/panel/api/server/importDB`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    await addLog(`بازیابی بکاپ`, `بازیابی بکاپ روی ${panel.name} انجام شد`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}
