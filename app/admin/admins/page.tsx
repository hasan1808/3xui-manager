"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/lib/toast-context";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

interface AdminUser {
  id: string;
  username: string;
  role: string;
  balance: number;
  createdAt: string;
  createdBy: string | null;
}

function formatNum(n: string) {
  const v = n.replace(/[^0-9]/g, "");
  if (!v) return "";
  return new Intl.NumberFormat("en-US").format(parseInt(v, 10));
}

function parseNum(s: string) {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

export default function AdminsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", role: "customer" });
  const [editingPass, setEditingPass] = useState<string | null>(null);
  const [editPass, setEditPass] = useState("");
  const [balanceMode, setBalanceMode] = useState<{ id: string; username: string } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"admins" | "wallet">(searchParams.get("tab") === "wallet" ? "wallet" : "admins");
  const [walletRequests, setWalletRequests] = useState<any[]>([]);
  const [cardAmounts, setCardAmounts] = useState<Record<string, string>>({});
  const [cardDescs, setCardDescs] = useState<Record<string, string>>({});
  const [cardReceipts, setCardReceipts] = useState<Record<string, string>>({});
  const [bankCards, setBankCards] = useState<{ id: string; cardNumber: string; bankName: string; accountHolder: string; shaba?: string }[]>([]);
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [cardForm, setCardForm] = useState({ cardNumber: "", bankName: "", accountHolder: "", shaba: "" });
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);

  function load() {
    fetch("/api/admins/me").then((r) => r.json()).then(setCurrentUser);
    fetch("/api/admins").then((r) => { if (r.ok) return r.json(); throw new Error(); }).then(setAdmins).catch(() => {});
    fetch("/api/wallet").then((r) => { if (r.ok) return r.json(); }).then(setWalletRequests).catch(() => {});
    fetch("/api/wallet/bank-card").then((r) => { if (r.ok) return r.json(); }).then((d) => { if (Array.isArray(d)) setBankCards(d); }).catch(() => {});
  }

  useEffect(load, []);

  async function addAdmin(e: FormEvent) {
    e.preventDefault();
    if (newAdmin.password.length < 4) { toast("رمز حداقل ۴ کاراکتر", "error"); return; }
    setSaving(true);
    const res = await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAdmin),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("مشتری اضافه شد");
    setShowAdd(false);
        setNewAdmin({ username: "", password: "", role: "customer" });
    load();
  }

  async function deleteAdmin(id: string, username: string) {
    if (!confirm(`آیا از حذف "${username}" اطمینان دارید؟`)) return;
    const res = await fetch(`/api/admins/${id}`, { method: "DELETE" });
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("مشتری حذف شد");
    load();
  }

  async function changeAdminPassword(id: string) {
    if (editPass.length < 4) { toast("رمز حداقل ۴ کاراکتر", "error"); return; }
    const res = await fetch(`/api/admins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: editPass }),
    });
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("رمز تغییر یافت");
    setEditingPass(null);
    setEditPass("");
  }

  async function updateBalance(id: string) {
    const amount = parseNum(balanceAmount);
    if (!amount) { toast("مقدار نامعتبر", "error"); return; }
    setSaving(true);
    const res = await fetch(`/api/admins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: amount }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("موجودی بروزرسانی شد");
    setBalanceMode(null);
    setBalanceAmount("");
    load();
  }

  async function submitRequest(cardId: string, amount: number, description: string) {
    if (!amount || amount <= 0) { toast("مبلغ نامعتبر", "error"); return; }
    setSaving(true);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description: description || "درخواست شارژ", receipt: cardReceipts[cardId] || undefined }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("درخواست ارسال شد");
    setCardAmounts((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    setCardDescs((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    setCardReceipts((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    load();
  }

  async function resolveReq(id: string, action: "approved" | "rejected") {
    setSaving(true);
    const res = await fetch("/api/wallet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, action }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast(action === "approved" ? "تایید شد" : "رد شد");
    load();
  }

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>, cardId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCardReceipts({ ...cardReceipts, [cardId]: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function saveBankCard() {
    if (!cardForm.cardNumber || !cardForm.bankName || !cardForm.accountHolder) {
      toast("شماره کارت، بانک و صاحب حساب الزامی است", "error"); return;
    }
    setSaving(true);
    const res = await fetch("/api/wallet/bank-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardForm),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("کارت اضافه شد");
    setCardForm({ cardNumber: "", bankName: "", accountHolder: "", shaba: "" });
    setShowAddCardForm(false);
    fetch("/api/wallet/bank-card").then((r) => { if (r.ok) return r.json(); }).then((d) => { if (Array.isArray(d)) setBankCards(d); }).catch(() => {});
  }

  async function deleteBankCard(id: string) {
    setSaving(true);
    const res = await fetch("/api/wallet/bank-card", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("کارت حذف شد");
    fetch("/api/wallet/bank-card").then((r) => { if (r.ok) return r.json(); }).then((d) => { if (Array.isArray(d)) setBankCards(d); }).catch(() => {});
  }

  const isSuper = currentUser?.role === "superadmin";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="مدیریت مشتری‌ها" />
      <PageTransition>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {isSuper && (
          <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-tertiary)" }}>
            <button onClick={() => setTab("admins")}
              className={`flex-1 py-2 rounded text-sm font-medium transition ${tab === "admins" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              مشتری‌ها
            </button>
            <button onClick={() => setTab("wallet")}
              className={`flex-1 py-2 rounded text-sm font-medium transition ${tab === "wallet" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              کیف پول
            </button>
          </div>
        )}

        {tab === "admins" && (
          <>
            {/* add admin */}
            {isSuper && (
              <div className="text-left">
                <button onClick={() => setShowAdd(!showAdd)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition">
                  {showAdd ? "انصراف" : "+ مشتری جدید"}
                </button>
              </div>
            )}

            {showAdd && isSuper && (
              <form onSubmit={addAdmin} className="grid md:grid-cols-4 gap-3 p-4 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <input placeholder="نام کاربری" required value={newAdmin.username}
                  onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                <input type="password" placeholder="رمز عبور" required value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                <select value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                  className="p-2.5 rounded border outline-none text-sm"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                  <option value="customer">مشتری</option>
                  <option value="superadmin">سوپرادمین</option>
                </select>
                <button type="submit" disabled={saving}
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
                  {saving ? "..." : "ایجاد"}
                </button>
              </form>
            )}

            {/* admin list */}
            <div className="space-y-2">
              {admins.length === 0 && <div className="text-center py-8 text-gray-400">هیچ مشتری یافت نشد</div>}
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-secondary)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: admin.role === "superadmin" ? "var(--bg-tertiary)" : "var(--bg-tertiary)" }}>
                      {admin.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {admin.username}
                        <span className={`text-xs px-2 py-0.5 rounded ${admin.role === "superadmin" ? "bg-purple-600" : "bg-blue-600"}`}>
                          {admin.role === "superadmin" ? "سوپرادمین" : "مشتری"}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        موجودی: {admin.balance?.toLocaleString("en-US") ?? 0} تومان
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPass === admin.id ? (
                      <div className="flex items-center gap-1">
                        <input type="password" placeholder="رمز جدید" value={editPass}
                          onChange={(e) => setEditPass(e.target.value)}
                          className="p-1.5 rounded border outline-none text-sm w-28"
                          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                        <button onClick={() => changeAdminPassword(admin.id)} className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs transition">ذخیره</button>
                        <button onClick={() => { setEditingPass(null); setEditPass(""); }} className="px-2 py-1.5 rounded text-xs transition bg-gray-600 hover:bg-gray-500">لغو</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingPass(admin.id); setEditPass(""); }} className="px-2 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition">تغییر رمز</button>
                    )}
                    {isSuper && admin.role !== "superadmin" && (
                      <button onClick={() => deleteAdmin(admin.id, admin.username)} className="px-2 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs transition">حذف</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "wallet" && (
          <>
            {/* current user balance card */}
            {currentUser && !isSuper && (
              <div className="rounded-lg p-6 shadow text-center" style={{ background: "var(--bg-secondary)" }}>
                <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>موجودی شما</div>
                <div className="text-3xl font-bold text-green-400">{currentUser.balance?.toLocaleString("en-US") ?? 0}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>تومان</div>
              </div>
            )}

            {/* Request top-up form */}
            {!isSuper && (
              <div className="rounded-lg p-5 shadow" style={{ background: "var(--bg-secondary)" }}>
                <h3 className="text-lg font-semibold mb-3">درخواست شارژ کیف‌پول</h3>
                {bankCards.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>هنوز کارت بانکی تعریف نشده است</p>
                ) : (
                  bankCards.map((c) => {
                    const key = c.id;
                    const amt = cardAmounts[key] || "";
                    const desc = cardDescs[key] || "";
                    const receipt = cardReceipts[key] || "";
                    return (
                      <div key={c.id} className="rounded p-3 mb-3 text-sm" style={{ background: "var(--bg-tertiary)" }}>
                        <p className="font-mono text-base cursor-pointer hover:opacity-70 transition" dir="ltr" onClick={() => { navigator.clipboard.writeText(c.cardNumber); toast("کپی شد"); }}>{c.cardNumber}</p>
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
                  })
                )}
              </div>
            )}

            {/* Pending requests for superadmin */}
            {isSuper && walletRequests.length > 0 && (
              <div className="rounded-lg p-5 shadow" style={{ background: "var(--bg-secondary)" }}>
                <h3 className="text-lg font-semibold mb-3">درخواست‌های شارژ ({walletRequests.length})</h3>
                <div className="mb-3">
                  {walletRequests.map((r) => (
                    <div key={r.id} className="p-3 rounded mb-2" style={{ background: "var(--bg-tertiary)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="font-medium">{r.adminUsername}</div>
                          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {r.amount.toLocaleString("en-US")} تومان
                          </div>
                          {r.description && (
                            <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                              {r.description}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => resolveReq(r.id, "approved")} disabled={saving}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition">تایید</button>
                          <button onClick={() => resolveReq(r.id, "rejected")} disabled={saving}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition">رد</button>
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
              </div>
            )}

            {/* Bank card management (superadmin only) */}
            {isSuper && (
              <div className="rounded-lg p-5 shadow mb-4" style={{ background: "var(--bg-secondary)" }}>
                <h3 className="text-lg font-semibold mb-3">اطلاعات کارت‌های بانکی</h3>

                {bankCards.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded p-3 mb-2 text-sm" style={{ background: "var(--bg-tertiary)" }}>
                    <div>
                      <p className="font-mono text-base cursor-pointer hover:opacity-70 transition" dir="ltr" onClick={() => { navigator.clipboard.writeText(c.cardNumber); toast("کپی شد"); }}>{c.cardNumber}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.bankName} - {c.accountHolder}</p>
                      {c.shaba && <p className="text-xs font-mono" style={{ color: "var(--text-secondary)" }} dir="ltr">شبا: {c.shaba}</p>}
                    </div>
                    <button onClick={() => deleteBankCard(c.id)} disabled={saving}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition">حذف</button>
                  </div>
                ))}

                {showAddCardForm ? (
                  <div>
                    <input placeholder="شماره کارت" value={cardForm.cardNumber}
                      onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                      className="w-full p-2 rounded border outline-none text-sm mb-2 font-mono" dir="ltr"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                    <div className="flex gap-2 mb-2">
                      <input placeholder="نام بانک" value={cardForm.bankName}
                        onChange={(e) => setCardForm({ ...cardForm, bankName: e.target.value })}
                        className="flex-1 p-2 rounded border outline-none text-sm"
                        style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                      <input placeholder="صاحب حساب" value={cardForm.accountHolder}
                        onChange={(e) => setCardForm({ ...cardForm, accountHolder: e.target.value })}
                        className="flex-1 p-2 rounded border outline-none text-sm"
                        style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                    </div>
                    <input placeholder="شماره شبا (اختیاری)" value={cardForm.shaba}
                      onChange={(e) => setCardForm({ ...cardForm, shaba: e.target.value })}
                      className="w-full p-2 rounded border outline-none text-sm mb-2 font-mono" dir="ltr"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                    <div className="flex gap-2">
                      <button onClick={saveBankCard} disabled={saving}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm transition">افزودن</button>
                      <button onClick={() => { setShowAddCardForm(false); setCardForm({ cardNumber: "", bankName: "", accountHolder: "", shaba: "" }); }}
                        className="px-4 py-2 rounded text-sm transition" style={{ background: "var(--bg-tertiary)" }}>انصراف</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddCardForm(true)}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">+ افزودن کارت جدید</button>
                )}
              </div>
            )}

            {/* all admins wallet (superadmin only) */}
            {isSuper && (
              <div className="rounded-lg p-5 shadow" style={{ background: "var(--bg-secondary)" }}>
                <h3 className="text-lg font-semibold mb-4">مدیریت موجودی مشتری‌ها</h3>
                <div className="space-y-2">
                  {admins.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 rounded" style={{ background: "var(--bg-tertiary)" }}>
                      <div>
                        <span className="font-medium">{admin.username}</span>
                        <span className="mr-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          موجودی: {admin.balance?.toLocaleString("en-US") ?? 0} تومان
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {balanceMode?.id === admin.id ? (
                          <div className="flex items-center gap-1">
                            <input type="text" inputMode="numeric" placeholder="مقدار" value={formatNum(balanceAmount)}
                              onChange={(e) => setBalanceAmount(e.target.value.replace(/,/g, ""))}
                              className="p-1.5 rounded border outline-none text-sm w-24 text-left"
                              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                            <button onClick={() => updateBalance(admin.id)} disabled={saving}
                              className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs transition">ذخیره</button>
                            <button onClick={() => { setBalanceMode(null); setBalanceAmount(""); }} className="px-2 py-1.5 rounded text-xs transition bg-gray-600 hover:bg-gray-500">لغو</button>
                          </div>
                        ) : (
                          <button onClick={() => { setBalanceMode({ id: admin.id, username: admin.username }); setBalanceAmount(String(admin.balance ?? 0)); }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs transition">
                            تنظیم موجودی
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
      </PageTransition>
    </div>
  );
}
