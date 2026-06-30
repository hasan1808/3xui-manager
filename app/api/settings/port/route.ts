import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export async function GET() {
  const auth = await requireAuth(new Request("http://localhost"));
  if (auth) return auth;
  const envPath = path.join(process.cwd(), ".env.local");
  let port = "3000";
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^PORT=(.+)$/m);
      if (match) port = match[1].trim();
    }
  } catch {}
  return NextResponse.json({ port });
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

  const envPath = path.join(process.cwd(), ".env.local");
  try {
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

  try {
    setTimeout(() => {
      try { execSync("systemctl restart 3xui-manager", { timeout: 10000 }); } catch {}
    }, 1000);
  } catch {}

  return NextResponse.json({ ok: true, port: portNum, message: `پورت به ${portNum} تغییر کرد. سرویس در حال ریستارت...` });
}
