import fs from "fs";
import path from "path";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const PASS_FILE = path.join(DATA_DIR, ".admin-pass");
const USER_FILE = path.join(DATA_DIR, ".admin-user");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getAdminPassword(): string {
  const envPass = process.env.ADMIN_PASS;
  try {
    ensureDir();
    if (fs.existsSync(PASS_FILE)) {
      return fs.readFileSync(PASS_FILE, "utf-8").trim();
    }
  } catch {}
  return envPass || "admin123";
}

export function getAdminUsername(): string {
  const envUser = process.env.ADMIN_USER;
  try {
    ensureDir();
    if (fs.existsSync(USER_FILE)) {
      return fs.readFileSync(USER_FILE, "utf-8").trim();
    }
  } catch {}
  return envUser || "admin";
}

export async function setAdminPassword(password: string): Promise<void> {
  await withLock("admin-pass", () => {
    ensureDir();
    writeFileAtomic(PASS_FILE, password);
  });
}

export async function setAdminUsername(username: string): Promise<void> {
  await withLock("admin-user", () => {
    ensureDir();
    writeFileAtomic(USER_FILE, username);
  });
}
