import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getTransactions, getPricing } from "@/lib/finance-store";
import { getAdmins, getAdminByUsername } from "@/lib/admin-store";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

interface InboundOwnership { panelId: string; inboundId: number; assignedTo: string; }

function getOwnershipData(): InboundOwnership[] {
  const f = path.join(DATA_DIR, "inbound-ownership.json");
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, "utf-8")); } catch { return []; }
}

function readTrafficSnapshots(): { panelId: string; clients: { inboundId: number; totalBytes: number }[] }[] {
  const file = path.join(DATA_DIR, "traffic-snapshots.json");
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return (raw.snapshots || []).map((s: any) => ({
      panelId: s.panelId,
      clients: (s.clients || []).map((c: any) => ({ inboundId: c.inboundId, totalBytes: c.totalBytes || 0 })),
    }));
  } catch { return []; }
}

function calcCurrentGb(adminId: string): number {
  const ownership = getOwnershipData().filter((o) => o.assignedTo === adminId);
  if (!ownership.length) return 0;
  const keySet = new Set(ownership.map((o) => `${o.panelId}:${o.inboundId}`));
  const snapshots = readTrafficSnapshots();
  let totalBytes = 0;
  for (const snap of snapshots) {
    for (const client of snap.clients) {
      if (keySet.has(`${snap.panelId}:${client.inboundId}`)) {
        totalBytes += client.totalBytes;
      }
    }
  }
  return Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admins = getAdmins();
  const txns = getTransactions();
  const pricing = getPricing();

  const myAdmin = getAdminByUsername(user.username);
  const myBalance = myAdmin?.balance || 0;

  const myTxns = txns.filter((t) => t.adminId === user.userId);
  const myUsageTxns = myTxns.filter((t) => t.type === "usage");
  const myUsage = myUsageTxns.reduce((s, t) => s + t.amount, 0);
  const myDeposits = myTxns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);

  function extractGb(desc: string): number {
    const m = desc.match(/\(?([\d,.]+)\s*GB\)?/i);
    return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
  }

  const myUsageGb = myUsageTxns.reduce((s, t) => s + extractGb(t.description || ""), 0);
  const myCurrentGb = calcCurrentGb(user.userId);

  const customerIds = new Set(admins.filter((a) => a.role !== "superadmin").map((a) => a.id));
  const totalCustomersBalance = admins.filter((a) => a.role !== "superadmin").reduce((s, a) => s + (a.balance || 0), 0);
  const totalUsageTxns = txns.filter((t) => t.type === "usage" && customerIds.has(t.adminId));
  const totalUsage = totalUsageTxns.reduce((s, t) => s + t.amount, 0);
  const totalUsageGb = totalUsageTxns.reduce((s, t) => s + extractGb(t.description || ""), 0);
  const totalCustomersDeposits = txns.filter((t) => t.type === "deposit" && customerIds.has(t.adminId)).reduce((s, t) => s + t.amount, 0);

  let totalCurrentGb = 0;
  if (user.role === "superadmin") {
    for (const cid of customerIds) {
      totalCurrentGb += calcCurrentGb(cid);
    }
  }

  return NextResponse.json({
    myBalance,
    myUsage,
    myUsageGb,
    myCurrentGb,
    myDeposits,
    myTxnCount: myTxns.length,
    currency: pricing.currency,
    adminCount: admins.filter((a) => a.role !== "superadmin").length,
    isSuperadmin: user.role === "superadmin",
    totalCustomersBalance,
    totalCustomersDeposits,
    totalUsage,
    totalUsageGb,
    totalCurrentGb,
  });
}
