import { NextResponse } from "next/server";
import { requireAuth, getAuthUser } from "@/lib/auth-api";
import { getTransactions } from "@/lib/finance-store";
import { toJalaali } from "jalaali-js";

const PERSIAN_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function extractGb(desc: string): number {
  const m = desc.match(/\(?([\d,.]+)\s*GB\)?/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

function toPersianDate(iso: string): string {
  const d = new Date(iso);
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy}`;
}

function toPersianDateTime(iso: string): string {
  const d = new Date(iso);
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy} ساعت ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth) return auth;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const format = url.searchParams.get("format") || "json";

  let txns = getTransactions();
  if (user.role !== "superadmin") {
    txns = txns.filter((t) => t.adminId === user.userId);
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const mon = parseInt(monthStr);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString();

  txns = txns.filter((t) => t.createdAt >= startDate && t.createdAt <= endDate);

  const usageTxns = txns.filter((t) => t.type === "usage");
  const totalUsage = usageTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalUsageGb = usageTxns.reduce((s, t) => s + extractGb(t.description || ""), 0);

  const summary = {
    month,
    totalTransactions: txns.length,
    totalAdjustments: txns.filter((t) => t.type === "adjustment").reduce((s, t) => s + t.amount, 0),
    totalUsage,
    totalUsageGb,
    totalDeposits: txns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0),
    transactions: txns.map((t) => ({ ...t, persianDate: toPersianDate(t.createdAt), persianDateTime: toPersianDateTime(t.createdAt) })),
  };

  if (format === "csv") {
    const header = "شناسه,ادمین,نوع,مقدار,موجودی قبلی,موجودی بعدی,شرح,تاریخ";
    const rows = txns.map((t) =>
      `"${t.id}","${t.adminUsername}","${t.type}","${t.amount}","${t.balanceBefore}","${t.balanceAfter}","${t.description}","${toPersianDateTime(t.createdAt)}"`
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${month}.csv"`,
      },
    });
  }

  return NextResponse.json(summary);
}