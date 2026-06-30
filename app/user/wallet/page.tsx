"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

function formatNum(n: string) {
  const v = n.replace(/[^0-9]/g, "");
  if (!v) return "";
  return new Intl.NumberFormat("en-US").format(parseInt(v, 10));
}

function parseNum(s: string) {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

export default function UserWallet() {
  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [bankCards, setBankCards] = useState<{ id: string; cardNumber: string; bankName: string; accountHolder: string; shaba?: string }[]>([]);
  const [cardAmounts, setCardAmounts] = useState<Record<string, string>>({});
  const [cardDescs, setCardDescs] = useState<Record<string, string>>({});
  const [cardReceipts, setCardReceipts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetch("/api/admins/me").then((r) => r.json()),
      fetch("/api/wallet").then((r) => { if (r.ok) return r.json(); }).catch(() => []),
      fetch("/api/wallet/bank-card").then((r) => { if (r.ok) return r.json(); }).catch(() => []),
    ]).then(([me, reqs, cards]) => {
      setBalance(me.balance || 0);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setBankCards(Array.isArray(cards) ? cards : []);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }

  useEffect(load, []);

  async function submitRequest(cardId: string, amount: number, description: string) {
    if (!amount || amount <= 0) return;
    setSaving(true);
    await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description: description || "درخواست شارژ", receipt: cardReceipts[cardId] || undefined }),
    });
    setSaving(false);
    setCardAmounts((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    setCardDescs((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    setCardReceipts((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    load();
  }

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>, cardId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCardReceipts({ ...cardReceipts, [cardId]: reader.result as string });
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <NavBar title="کیف پول" />
        <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="کیف پول" backTo="/user" />

      <div className="p-3 sm:p-6 max-w-4xl mx-auto">
        <PageTransition>
          <div className="rounded-lg p-6 shadow text-center mb-6" style={{ background: "var(--bg-secondary)" }}>
            <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>موجودی شما</div>
            <div className="text-3xl font-bold text-green-400">{balance.toLocaleString("en-US") ?? 0}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>تومان</div>
          </div>

          {bankCards.length > 0 && (
            <div className="rounded-lg p-5 shadow mb-6" style={{ background: "var(--bg-secondary)" }}>
              <h3 className="text-lg font-semibold mb-3">درخواست شارژ کیف‌پول</h3>
              {bankCards.map((c) => {
                const key = c.id;
                const amt = cardAmounts[key] || "";
                const desc = cardDescs[key] || "";
                const receipt = cardReceipts[key] || "";
                return (
                  <div key={c.id} className="rounded p-3 mb-3 text-sm" style={{ background: "var(--bg-tertiary)" }}>
                    <p className="font-mono text-base cursor-pointer hover:opacity-70 transition" dir="ltr"
                      onClick={() => { navigator.clipboard.writeText(c.cardNumber); }}>
                      {c.cardNumber}
                    </p>
                    <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{c.bankName} - {c.accountHolder}</p>
                    {c.shaba && <p className="text-xs font-mono mb-2" style={{ color: "var(--text-secondary)" }} dir="ltr">شبا: {c.shaba}</p>}
                    <input type="text" inputMode="numeric" placeholder="مبلغ (تومان)" value={formatNum(amt)}
                      onChange={(e) => setCardAmounts({ ...cardAmounts, [key]: e.target.value.replace(/,/g, "") })}
                      className="w-full p-2.5 rounded border outline-none text-sm mb-2"
                      style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                    <input placeholder="توضیح (اختیاری)" value={desc}
                      onChange={(e) => setCardDescs({ ...cardDescs, [key]: e.target.value })}
                      className="w-full p-2.5 rounded border outline-none text-sm mb-2"
                      style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                    <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                      <input type="file" accept="image/*" onChange={(e) => handleReceiptFile(e, key)} className="hidden" />
                      <span className="px-3 py-1.5 rounded text-xs transition bg-blue-600 hover:bg-blue-700 text-white">انتخاب رسید</span>
                      {receipt ? "رسید انتخاب شد" : "تصویر رسید واریز"}
                    </label>
                    <button onClick={() => submitRequest(c.id, parseNum(amt), desc)}
                      disabled={saving || !amt}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm transition">
                      {saving ? "..." : "ارسال درخواست"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {requests.length > 0 && (
            <div className="rounded-lg p-5 shadow" style={{ background: "var(--bg-secondary)" }}>
              <h3 className="text-lg font-semibold mb-3">درخواست‌های من</h3>
              {requests.map((r) => (
                <div key={r.id} className="p-3 rounded mb-2" style={{ background: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {r.amount.toLocaleString("en-US")} تومان
                      </div>
                      {r.description && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{r.description}</div>
                      )}
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {r.status === "approved" ? "✅ تایید شده" : r.status === "rejected" ? "❌ رد شده" : "⏳ در انتظار"}
                      </div>
                    </div>
                  </div>
                  {r.receipt && (
                    <div className="mt-2">
                      {expandedReceipt === r.id ? (
                        <div className="relative">
                          <img src={r.receipt} alt="رسید" className="max-h-80 rounded cursor-pointer"
                            onClick={() => setExpandedReceipt(null)} />
                          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>برای بستن کلیک کنید</p>
                        </div>
                      ) : (
                        <button onClick={() => setExpandedReceipt(r.id)}
                          className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 transition">مشاهده رسید</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PageTransition>
      </div>
    </div>
  );
}
