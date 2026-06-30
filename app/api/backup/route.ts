import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILES = [
  "admins.json",
  "panels.json",
  "bank-card.json",
  "inbound-ownership.json",
  "auto-deduct.json",
  "transactions.json",
  "traffic-snapshots.json",
  "traffic-history.json",
  "wallet-requests.json",
  "logs.json",
  "settings.json",
  "pricing.json",
  "client-pricing.json",
  "client-links.json",
  "notification-settings.json",
];

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;

  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    for (const file of DATA_FILES) {
      const filePath = path.join(DATA_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        zip.file(file, content);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = `3xui-backup-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.panels || body.settings) {
        const { restoreSystemBackup } = await import("@/lib/backup-store");
        const result = await restoreSystemBackup(body);
        if (!result.ok) {
          return NextResponse.json({ error: result.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, message: result.message });
      }
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const allowedFiles = new Set(DATA_FILES);
    let restoredCount = 0;

    for (const [filename, fileData] of Object.entries(zip.files)) {
      if (fileData.dir) continue;
      const baseName = path.basename(filename);
      if (!allowedFiles.has(baseName)) continue;

      const content = await fileData.async("nodebuffer");
      const targetPath = path.join(DATA_DIR, baseName);
      fs.writeFileSync(targetPath, content);
      restoredCount++;
    }

    return NextResponse.json({
      ok: true,
      message: `بازیابی شد: ${restoredCount} فایل`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "خطا: " + (e.message || "") }, { status: 500 });
  }
}
