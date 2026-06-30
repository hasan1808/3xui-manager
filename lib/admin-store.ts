import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { withLock, writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const PASS_FILE = path.join(DATA_DIR, ".admin-pass");
const USER_FILE = path.join(DATA_DIR, ".admin-user");

const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function isHashed(password: string): boolean {
  return /^\$2[aby]\$\d+\$/.test(password);
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  role: "superadmin" | "customer";
  balance: number;
  createdAt: string;
  createdBy: string | null;
}

interface AdminsData {
  admins: Admin[];
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function migrateFromOldFiles(): Admin[] {
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASS;
  let username = "admin";
  let password = "admin123";
  try {
    if (fs.existsSync(USER_FILE)) username = fs.readFileSync(USER_FILE, "utf-8").trim();
    else if (envUser) username = envUser;
  } catch {}
  try {
    if (fs.existsSync(PASS_FILE)) password = fs.readFileSync(PASS_FILE, "utf-8").trim();
    else if (envPass) password = envPass;
  } catch {}
  return [{
    id: crypto.randomUUID(),
    username,
    password: hashPassword(password),
    role: "superadmin",
    balance: 0,
    createdAt: new Date().toISOString(),
    createdBy: null,
  }];
}

function readData(): AdminsData {
  ensureDir();
  if (!fs.existsSync(ADMINS_FILE)) {
    const admins = migrateFromOldFiles();
    const data: AdminsData = { admins };
    writeFileAtomic(ADMINS_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  const raw = JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"));
  let changed = false;
  if (raw.admins) {
    if (raw.admins[0]?.balance === undefined) {
      raw.admins = raw.admins.map((a: any) => ({ ...a, balance: a.balance ?? 0 }));
      changed = true;
    }
    for (const a of raw.admins) {
      if (!isHashed(a.password)) {
        a.password = hashPassword(a.password);
        changed = true;
      }
      if (a.role === "admin") {
        a.role = "customer";
        changed = true;
      }
    }
  }
  if (changed) writeFileAtomic(ADMINS_FILE, JSON.stringify(raw, null, 2));
  return raw;
}

function writeData(data: AdminsData) {
  ensureDir();
  writeFileAtomic(ADMINS_FILE, JSON.stringify(data, null, 2));
}

export function getAdmins(): Admin[] {
  return readData().admins;
}

export function getAdminByUsername(username: string): Admin | undefined {
  return getAdmins().find((a) => a.username === username);
}

export function getAdminById(id: string): Admin | undefined {
  return getAdmins().find((a) => a.id === id);
}

export function verifyAdmin(username: string, password: string): Admin | null {
  const admin = getAdminByUsername(username);
  if (!admin || !comparePassword(password, admin.password)) return null;
  return admin;
}

export async function addAdmin(username: string, password: string, role: "superadmin" | "customer", createdBy: string | null): Promise<Admin> {
  return withLock("admins", () => {
    const data = readData();
    if (data.admins.find((a) => a.username === username)) {
      throw new Error("نام کاربری تکراری است");
    }
    const admin: Admin = {
      id: crypto.randomUUID(),
      username,
      password: hashPassword(password),
      role,
      balance: 0,
      createdAt: new Date().toISOString(),
      createdBy,
    };
    data.admins.push(admin);
    writeData(data);
    return admin;
  });
}

export async function updateAdmin(id: string, updates: Partial<Pick<Admin, "username" | "password" | "role" | "balance">>): Promise<Admin> {
  return withLock("admins", () => {
    const data = readData();
    const idx = data.admins.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ادمین یافت نشد");
    if (updates.username && data.admins.some((a, i) => a.username === updates.username && i !== idx)) {
      throw new Error("نام کاربری تکراری است");
    }
    const toApply = { ...updates };
    if (toApply.password) toApply.password = hashPassword(toApply.password);
    data.admins[idx] = { ...data.admins[idx], ...toApply };
    writeData(data);
    return data.admins[idx];
  });
}

export async function deleteAdmin(id: string): Promise<void> {
  return withLock("admins", () => {
    const data = readData();
    const idx = data.admins.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ادمین یافت نشد");
    data.admins.splice(idx, 1);
    writeData(data);
  });
}

export function getAdminPassword(): string {
  const admins = getAdmins();
  return admins[0]?.password || "admin123";
}

export async function setAdminPassword(password: string): Promise<void> {
  const admins = getAdmins();
  if (admins.length > 0) {
    await updateAdmin(admins[0].id, { password });
  }
}

export function getAdminUsername(): string {
  const admins = getAdmins();
  return admins[0]?.username || "admin";
}

export async function setAdminUsername(username: string): Promise<void> {
  const admins = getAdmins();
  if (admins.length > 0) {
    await updateAdmin(admins[0].id, { username });
  }
}
