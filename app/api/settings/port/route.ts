import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function readCurrentPort(): string {
  // Try systemd service file
  try {
    const serviceFile = "/etc/systemd/system/3xui-manager.service";
    if (fs.existsSync(serviceFile)) {
      const svc = fs.readFileSync(serviceFile, "utf-8");
      const match = svc.match(/Environment=PORT=(\d+)/);
      if (match) return match[1];
    }
  } catch {}

  // Fallback to .env.local
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^PORT=(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch {}

  return process.env.PORT || "3000";
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  return NextResponse.json({ port: readCurrentPort() });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "فقط مدیر اصلی" }, { status: 403 });
  }

  const { port } = await req.json();
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return NextResponse.json({ error: "پورت نامعتبر" }, { status: 400 });
  }

  // Update .env.local
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    }
    if (content.match(/^PORT=/m)) {
      content = content.replace(/^PORT=.+$/m, `PORT=${portNum}`);
    } else {
      content = `PORT=${portNum}\n` + content;
    }
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (e: any) {
    return NextResponse.json({ error: "خطا در ذخیره: " + e.message }, { status: 500 });
  }

  // Update systemd service file and restart
  try {
    setTimeout(() => {
      try {
        const serviceFile = "/etc/systemd/system/3xui-manager.service";
        if (fs.existsSync(serviceFile)) {
          let svc = fs.readFileSync(serviceFile, "utf-8");
          if (svc.match(/Environment=PORT=\d+/)) {
            svc = svc.replace(/Environment=PORT=\d+/, `Environment=PORT=${portNum}`);
          } else {
            svc = svc.replace(/\[Service\]/, `[Service]\nEnvironment=PORT=${portNum}`);
          }
          fs.writeFileSync(serviceFile, svc, "utf-8");
          execSync("systemctl daemon-reload", { timeout: 10000 });
        }
        execSync("systemctl restart 3xui-manager", { timeout: 10000 });
      } catch {}
    }, 1000);
  } catch {}

  return NextResponse.json({ ok: true, port: portNum, message: `پورت به ${portNum} تغییر کرد. سرویس در حال ریستارت...` });
}
