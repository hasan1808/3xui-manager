"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast-context";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import { formatPersianDateTime } from "@/lib/persian-date";

interface Pricing {
  pricePerGb: number;
  currency: string;
}

interface PanelInfo {
  id: string;
  name: string;
  pricePerGb?: number | null;
}

interface ClientPrice {
  id: string;
  panelId: string;
  adminUsername: string;
  pricePerGb: number;
}

interface Transaction {
  id: string;
  adminId: string;
  adminUsername: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface AdminInfo {
  id: string;
  username: string;
  balance: number;
}

export default function FinancePage() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [panels, setPanels] = useState<PanelInfo[]>([]);
  const [clientPrices, setClientPrices] = useState<ClientPrice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"panels" | "clients" | "transactions" | "autodeduct">("panels");
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [panelPrice, setPanelPrice] = useState("");
  const [newClientPrice, setNewClientPrice] = useState({ panelId: "", adminUsername: "", pricePerGb: "" });

  const [deductAdminId, setDeductAdminId] = useState("");
  const [deductAmount, setDeductAmount] = useState("");
  const [deductDesc, setDeductDesc] = useState("");
  const [autoDeduct, setAutoDeduct] = useState<{ enabled: boolean; runHour: number; runMinute: number; lastRun: string | null; lastResult: string | null } | null>(null);
  const [deductRunning, setDeductRunning] = useState(false);

  const [txFilterAdminId, setTxFilterAdminId] = useState("");
  const [txFilterType, setTxFilterType] = useState("");
  const [txFilterSearch, setTxFilterSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const txPageSize = 50;

  function loadTransactions(pg?: number) {
    const p = pg ?? txPage;
    const params = new URLSearchParams();
    if (txFilterAdminId) params.set("adminId", txFilterAdminId);
    if (txFilterType) params.set("type", txFilterType);
    if (txFilterSearch) params.set("search", txFilterSearch);
    params.set("page", String(p));
    params.set("pageSize", String(txPageSize));
    fetch(`/api/finance/transactions?${params}`).then((r) => r.json()).then((d) => {
      setTransactions(d.items ?? d);
      setTxTotal(d.total ?? d.length ?? 0);
      setTxPage(d.page ?? p);
    });
  }

  function load() {
    fetch("/api/finance/pricing").then((r) => r.json()).then(setPricing);
    fetch("/api/panels").then((r) => r.json()).then(setPanels);
    fetch("/api/finance/client-pricing").then((r) => { if (r.ok) return r.json(); }).then(setClientPrices).catch(() => {});
    loadTransactions();
    fetch("/api/admins/me").then((r) => { if (r.ok) return r.json(); }).then(setCurrentUser);
    fetch("/api/admins").then((r) => { if (r.ok) return r.json(); }).then(setAdmins).catch(() => {});
    fetch("/api/finance/auto-deduct").then((r) => { if (r.ok) return r.json(); }).then(setAutoDeduct).catch(() => {});
  }

  useEffect(load, []);
  useEffect(() => { loadTransactions(); }, [txFilterAdminId, txFilterType, txFilterSearch]);

  async function savePanelPrice(panelId: string) {
    const v = parseInt(panelPrice);
    if (isNaN(v) || v < 0) { toast("قیمت نامعتبر", "error"); return; }
    setSaving(true);
    const res = await fetch(`/api/panels/${panelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePerGb: v }),
    });
    setSaving(false);
    if (!res.ok) { toast("خطا", "error"); return; }
    toast("قیمت پنل ذخیره شد");
    setEditingPanel(null);
    setPanelPrice("");
    load();
  }

  async function clearPanelPrice(panelId: string) {
    setSaving(true);
    await fetch(`/api/panels/${panelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePerGb: null }),
    });
    setSaving(false);
    load();
    toast("قیمت پنل حذف شد (استفاده از نرخ جهانی)");
  }

  async function addClientPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientPrice.panelId || !newClientPrice.adminUsername) { toast("پنل و نام کاربری مشتری الزامی است", "error"); return; }
    const v = parseInt(newClientPrice.pricePerGb);
    if (isNaN(v) || v < 0) { toast("قیمت نامعتبر", "error"); return; }
    setSaving(true);
    const res = await fetch("/api/finance/client-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId: newClientPrice.panelId, adminUsername: newClientPrice.adminUsername, pricePerGb: v }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("قیمت کاربر ذخیره شد");
    setNewClientPrice({ panelId: "", adminUsername: "", pricePerGb: "" });
    load();
  }

  async function removeClientPrice(panelId: string, adminUsername: string) {
    const res = await fetch("/api/finance/client-pricing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId, adminUsername }),
    });
    if (!res.ok) { toast("خطا", "error"); return; }
    toast("قیمت کاربر حذف شد");
    load();
  }

  const isSuper = currentUser?.role === "superadmin";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="بخش مالی" />
      <PageTransition>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

        {/* tabs */}
        <div className="flex gap-1 rounded-lg p-1 overflow-x-auto" style={{ background: "var(--bg-tertiary)" }}>
          {(() => {
            const tabs: { key: string; label: string }[] = [
              { key: "panels", label: "پنل‌ها" },
              { key: "transactions", label: "تراکنش‌ها" },
            ];
            if (isSuper) {
              tabs.push({ key: "clients", label: "کاربران" });
              tabs.push({ key: "autodeduct", label: "کسر خودکار" });
            }
            return tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className={`flex-1 py-2 rounded text-sm font-medium transition whitespace-nowrap ${tab === t.key ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}>
                {t.label}
              </button>
            ));
          })()}
        </div>

        {tab === "panels" && (
          <div className="rounded-lg p-5 shadow space-y-3" style={{ background: "var(--bg-secondary)" }}>
            <h2 className="text-lg font-semibold mb-3">قیمت اختصاصی هر پنل</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              اگر برای پنلی قیمت تعیین نکنید، از نرخ سراسری استفاده می‌شود.
            </p>
            {panels.map((panel) => (
              <div key={panel.id} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
                <div>
                  <span className="font-medium">{panel.name}</span>
                  <span className="mr-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {panel.pricePerGb != null
                      ? `${panel.pricePerGb.toLocaleString("en-US")} ${pricing?.currency || "تومان"}/GB`
                      : "⚡ نرخ سراسری"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isSuper && (
                    <>
                      {editingPanel === panel.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" placeholder="قیمت" value={panelPrice}
                            onChange={(e) => setPanelPrice(e.target.value)}
                            className="p-1.5 rounded border outline-none text-sm w-24 text-left"
                            style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                          <button onClick={() => savePanelPrice(panel.id)} disabled={saving}
                            className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs transition">ذخیره</button>
                          <button onClick={() => { setEditingPanel(null); setPanelPrice(""); }}
                            className="px-2 py-1.5 rounded text-xs transition bg-gray-600 hover:bg-gray-500">لغو</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingPanel(panel.id); setPanelPrice(String(panel.pricePerGb ?? "")); }}
                          className="px-2 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition">
                          تنظیم قیمت
                        </button>
                      )}
                      {panel.pricePerGb != null && (
                        <button onClick={() => clearPanelPrice(panel.id)}
                          className="px-2 py-1.5 bg-red-600/50 hover:bg-red-700 rounded text-xs transition">
                          حذف
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "clients" && (
          <div className="rounded-lg p-5 shadow space-y-3" style={{ background: "var(--bg-secondary)" }}>
            <h2 className="text-lg font-semibold mb-3">قیمت اختصاصی کاربران</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              برای کاربران خاص می‌توانید قیمت جداگانه تعیین کنید. اولویت: قیمت کاربر &gt; قیمت پنل &gt; نرخ سراسری
            </p>

            {/* import/export buttons */}
            {isSuper && (
              <div className="flex gap-2 mb-4">
                <button onClick={() => {
                  const a = document.createElement("a");
                  a.href = "/api/finance/client-pricing/export";
                  a.download = "client-pricing-export.csv";
                  a.click();
                }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs transition">
                  خروجی CSV
                </button>
                <button onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv,.json";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const ext = file.name.split(".").pop();
                      let data: any[];
                      if (ext === "json") {
                        data = JSON.parse(text);
                      } else {
                        const lines = text.split("\n").filter(Boolean);
                        const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
                        data = lines.slice(1).map((line) => {
                          const vals = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
                          const obj: any = {};
                          headers.forEach((h, i) => { obj[h] = vals[i]; });
                          return obj;
                        });
                      }
                      const res = await fetch("/api/finance/client-pricing/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                      });
                      const result = await res.json();
                      if (result.ok) {
                        toast(`${result.imported} قیمت با موفقیت وارد شد`);
                        if (result.errors?.length) toast(`${result.errors.length} خطا`, "error");
                        load();
                      } else toast("خطا", "error");
                    } catch { toast("فایل نامعتبر", "error"); }
                  };
                  input.click();
                }} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition">
                  ورودی CSV
                </button>
              </div>
            )}

            {/* Add form */}
            {isSuper && (
              <form onSubmit={addClientPrice} className="grid md:grid-cols-4 gap-3 mb-4 p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
                <select value={newClientPrice.panelId} onChange={(e) => setNewClientPrice({ ...newClientPrice, panelId: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <option value="">انتخاب پنل</option>
                  {panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={newClientPrice.adminUsername} onChange={(e) => setNewClientPrice({ ...newClientPrice, adminUsername: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <option value="">انتخاب مشتری</option>
                  {admins.map((a) => <option key={a.id} value={a.username}>{a.username}</option>)}
                </select>
                <input type="number" placeholder="قیمت هر GB" value={newClientPrice.pricePerGb}
                  onChange={(e) => setNewClientPrice({ ...newClientPrice, pricePerGb: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                <button type="submit" disabled={saving}
                  className="py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm transition">
                  {saving ? "..." : "افزودن"}
                </button>
              </form>
            )}

            {/* Client prices list */}
            {clientPrices.length === 0 ? (
              <div className="text-center py-8 text-gray-400">هیچ قیمت اختصاصی برای کاربران تعریف نشده</div>
            ) : (
              <div className="space-y-2">
                {clientPrices.map((cp) => {
                  const panel = panels.find((p) => p.id === cp.panelId);
                  return (
                    <div key={cp.id} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
                      <div>
                        <span className="font-medium">{cp.adminUsername}</span>
                        <span className="mr-2 text-xs px-2 py-0.5 rounded bg-blue-600/50">{panel?.name || cp.panelId}</span>
                        <span className="mr-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {cp.pricePerGb.toLocaleString("en-US")} {pricing?.currency}/GB
                        </span>
                      </div>
                      {isSuper && (
                        <button onClick={() => removeClientPrice(cp.panelId, cp.adminUsername)}
                          className="px-2 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs transition">حذف</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "transactions" && (
          <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
            <h2 className="text-lg font-semibold">تاریخچه تراکنش‌ها</h2>

            {/* filters */}
            <div className="grid md:grid-cols-4 gap-3 p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
              {isSuper ? (
                <select value={txFilterAdminId} onChange={(e) => setTxFilterAdminId(e.target.value)}
                  className="p-2 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <option value="">همه مشتری‌ها</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
                </select>
              ) : (
                <div className="text-sm p-2" style={{ color: "var(--text-secondary)" }}>
                  {currentUser?.balance !== undefined && `موجودی: ${currentUser.balance.toLocaleString("en-US")} تومان`}
                </div>
              )}
              <select value={txFilterType} onChange={(e) => setTxFilterType(e.target.value)}
                className="p-2 rounded border outline-none text-sm"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                <option value="">همه انواع</option>
                <option value="adjustment">تعدیل</option>
                <option value="usage">مصرف</option>
                <option value="deposit">واریز</option>
              </select>
              <input placeholder="جستجو در شرح..." value={txFilterSearch}
                onChange={(e) => setTxFilterSearch(e.target.value)}
                className="p-2 rounded border outline-none text-sm"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              <button onClick={() => loadTransactions(1)}
                className="py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">فیلتر</button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">تراکنشی یافت نشد</div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{tx.description}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        {formatPersianDateTime(tx.createdAt)}
                        <span className="mr-2">موجودی قبلی: {tx.balanceBefore.toLocaleString("en-US")} → {tx.balanceAfter.toLocaleString("en-US")}</span>
                        <span className={`mr-2 text-xs px-1.5 py-0.5 rounded ${tx.type === "deposit" ? "bg-green-600/50" : tx.type === "usage" ? "bg-red-600/50" : "bg-yellow-600/50"}`}>
                          {tx.type === "deposit" ? "واریز" : tx.type === "usage" ? "مصرف" : "تعدیل"}
                        </span>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString("en-US")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {txTotal > txPageSize && (
              <div className="flex items-center justify-center gap-3 pt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <button disabled={txPage <= 1} onClick={() => loadTransactions(txPage - 1)} className="px-3 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>‹ قبل</button>
                <span>صفحه {txPage} از {Math.ceil(txTotal / txPageSize)}</span>
                <button disabled={txPage >= Math.ceil(txTotal / txPageSize)} onClick={() => loadTransactions(txPage + 1)} className="px-3 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>بعد ›</button>
              </div>
            )}
          </div>
        )}

        {tab === "autodeduct" && isSuper && (
          <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
            <h2 className="text-lg font-semibold">کسر خودکار از کیف پول</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              مصرف ترافیک هر اینباند به صورت خودکار از موجودی مشتریان منتسب کسر می‌شود.
            </p>

            {autoDeduct && (
              <>
                <div className="p-4 rounded-lg space-y-4" style={{ background: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">فعال‌سازی کسر خودکار</span>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        هزینه مصرف هر اینباند بین مشتریان منتسب تقسیم و از کیف پول آن‌ها کسر می‌شود
                      </p>
                    </div>
                    <button onClick={() => setAutoDeduct({ ...autoDeduct, enabled: !autoDeduct.enabled })}
                      className={`px-4 py-1.5 rounded text-sm transition ${autoDeduct.enabled ? "bg-green-600" : "bg-gray-600"}`}>
                      {autoDeduct.enabled ? "فعال" : "غیرفعال"}
                    </button>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-3">زمان اجرا</label>
                    <div className="p-5 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                      <div className="flex items-center justify-center gap-6">
                        {/* Hours */}
                        <div className="text-center">
                          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>ساعت</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAutoDeduct({ ...autoDeduct, runHour: Math.max(0, autoDeduct.runHour - 1) })}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition hover:scale-110"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              −
                            </button>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              {String(autoDeduct.runHour).padStart(2, "0")}
                            </div>
                            <button onClick={() => setAutoDeduct({ ...autoDeduct, runHour: Math.min(23, autoDeduct.runHour + 1) })}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition hover:scale-110"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              +
                            </button>
                          </div>
                        </div>

                        <div className="text-4xl font-bold pb-6" style={{ color: "var(--text-secondary)" }}>:</div>

                        {/* Minutes */}
                        <div className="text-center">
                          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>دقیقه</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAutoDeduct({ ...autoDeduct, runMinute: Math.max(0, autoDeduct.runMinute - 15) })}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition hover:scale-110"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              −
                            </button>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              {String(autoDeduct.runMinute).padStart(2, "0")}
                            </div>
                            <button onClick={() => setAutoDeduct({ ...autoDeduct, runMinute: Math.min(45, autoDeduct.runMinute + 15) })}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition hover:scale-110"
                              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {autoDeduct.lastRun && (
                  <div className="p-4 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
                    <h3 className="text-sm font-medium mb-2">آخرین وضعیت</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-secondary)" }}>زمان آخرین اجرا:</span>
                        <span>{formatPersianDateTime(autoDeduct.lastRun)}</span>
                      </div>
                      {autoDeduct.lastResult && (
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-secondary)" }}>نتیجه:</span>
                          <span>{autoDeduct.lastResult}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button onClick={async () => {
                    setSaving(true);
                    const res = await fetch("/api/finance/auto-deduct", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(autoDeduct),
                    });
                    setSaving(false);
                    if (res.ok) { toast("ذخیره شد"); setAutoDeduct(await res.json()); }
                    else toast("خطا", "error");
                  }} disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
                    {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                  </button>
                  <button onClick={async () => {
                    setDeductRunning(true);
                    const res = await fetch("/api/finance/auto-deduct", { method: "POST" });
                    setDeductRunning(false);
                    const data = await res.json();
                    if (data.ok) {
                      toast(data.message);
                      fetch("/api/finance/auto-deduct").then((r) => r.json()).then(setAutoDeduct);
                    } else {
                      toast(data.error || "خطا", "error");
                    }
                  }} disabled={deductRunning}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm transition">
                    {deductRunning ? "در حال اجرا..." : "اجرای فوری"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
      </PageTransition>
    </div>
  );
}
