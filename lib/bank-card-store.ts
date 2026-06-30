import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeFileAtomic } from "./lock";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "bank-card.json");

export interface BankCard {
  id: string;
  cardNumber: string;
  bankName: string;
  accountHolder: string;
  shaba?: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): BankCard[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    if (Array.isArray(raw)) return raw;
    if (raw.cardNumber) return [{ id: crypto.randomUUID(), ...raw }];
    return [];
  } catch { return []; }
}

function writeRaw(cards: BankCard[]): void {
  writeFileAtomic(FILE, JSON.stringify(cards, null, 2));
}

export function getBankCards(): BankCard[] {
  return readRaw();
}

export async function addBankCard(card: Omit<BankCard, "id">): Promise<BankCard> {
  const cards = readRaw();
  const newCard: BankCard = { id: crypto.randomUUID(), ...card };
  cards.push(newCard);
  writeRaw(cards);
  return newCard;
}

export async function deleteBankCard(id: string): Promise<void> {
  const cards = readRaw().filter((c) => c.id !== id);
  writeRaw(cards);
}
