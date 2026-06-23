import { randomBytes } from "crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const SECRET_FILE = join(process.cwd(), "data", ".jwt-secret");

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (existsSync(SECRET_FILE)) {
    try { return readFileSync(SECRET_FILE, "utf-8").trim(); } catch {}
  }
  const secret = randomBytes(32).toString("hex");
  try {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(SECRET_FILE, secret, "utf-8");
  } catch {}
  return secret;
}

let _secretBytes: Uint8Array | null = null;
export function getJwtSecretBytes(): Uint8Array {
  if (!_secretBytes) _secretBytes = new TextEncoder().encode(getJwtSecret());
  return _secretBytes;
}
