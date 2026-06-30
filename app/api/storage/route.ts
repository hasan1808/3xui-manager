import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const dataDir = path.join(process.cwd(), "data");
  let totalSize = 0;
  let fileCount = 0;
  const files: { name: string; size: number }[] = [];
  if (fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) {
        const fp = path.join(dataDir, e.name);
        const stat = fs.statSync(fp);
        totalSize += stat.size;
        fileCount++;
        files.push({ name: e.name, size: stat.size });
      }
    }
  }
  return NextResponse.json({ totalSize, fileCount, files });
}
