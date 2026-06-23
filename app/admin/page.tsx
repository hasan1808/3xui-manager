"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast-context";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

interface Settings {
  theme: string;
  dashboardRefreshInterval: number;
  autoBackup: boolean;
  autoBackupInterval: number;
  toastDuration: number;
  panelTimeout: number;
  panelRetryAttempts: number;
  compactSidebar: boolean;
}

const THEMES = [
  { value: "dark", label: "تیره" },
  { value: "light", label: "روشن" },
  { value: "system", label: "سیستم" },
];

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      await fetch("/api/backup/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: settings.autoBackup, intervalHours: settings.autoBackupInterval }),
      });
      setSaving(false);
      toast("تنظیمات ذخیره شد");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setSaving(false);
      toast("خطا در ذخیره", "error");
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (passForm.newPass !== passForm.confirm) { toast("تکرار رمز مطابقت ندارد", "error"); return; }
    if (passForm.newPass.length < 4) { toast("رمز حداقل ۴ کاراکتر", "error"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: passForm.current, newPassword: passForm.newPass }),
    });
    setSaving(false);
    if (!res.ok) { toast((await res.json()).error || "خطا", "error"); return; }
    toast("رمز تغییر یافت. لطفاً دوباره وارد شوید.");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!settings) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <NavBar title="تنظیمات" />
        <div className="text-center py-12"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="تنظیمات" />
      <PageTransition>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

        {/* ===== Password ===== */}
        <div className="rounded-lg p-5 shadow" style={{ background: "var(--bg-secondary)", border: "1px solid rgba(220,38,38,0.3)" }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">🔒 تغییر رمز عبور</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>پس از تغییر، از سیستم خارج می‌شوید</p>
          <form onSubmit={changePassword} className="grid md:grid-cols-4 gap-3">
            <input type="password" placeholder="رمز فعلی" required value={passForm.current}
              onChange={(e) => setPassForm({ ...passForm, current: e.target.value })}
              className="w-full p-2.5 rounded border outline-none text-sm transition-shadow duration-200 focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
            <input type="password" placeholder="رمز جدید" required value={passForm.newPass}
              onChange={(e) => setPassForm({ ...passForm, newPass: e.target.value })}
              className="w-full p-2.5 rounded border outline-none text-sm transition-shadow duration-200 focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
            <input type="password" placeholder="تکرار رمز جدید" required value={passForm.confirm}
              onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
              className="w-full p-2.5 rounded border outline-none text-sm transition-shadow duration-200 focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
            <button type="submit" disabled={saving}
              className="py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition flex items-center justify-center gap-2 text-sm">
              {saving ? <Spinner /> : null}
              {saving ? "..." : "تغییر رمز"}
            </button>
          </form>
        </div>

        {/* ===== Settings ===== */}
        <div className="rounded-lg p-5 md:p-6 shadow space-y-6" style={{ background: "var(--bg-secondary)" }}>
          <h2 className="text-lg font-semibold">تنظیمات برنامه</h2>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-medium mb-2.5" style={{ color: "var(--text-secondary)" }}>تم</h3>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button key={t.value} onClick={() => update("theme", t.value)}
                  className={`py-2.5 rounded text-sm transition ${settings.theme === t.value ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <hr style={{ borderColor: "var(--border-color)" }} />

          {/* Refresh + Notifications side by side on desktop */}
          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-medium mb-2.5" style={{ color: "var(--text-secondary)" }}>بازنگری خودکار داشبورد</h3>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60, 120, 300].map((v) => (
                  <button key={v} onClick={() => update("dashboardRefreshInterval", v)}
                    className={`py-2.5 rounded text-sm transition ${settings.dashboardRefreshInterval === v ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                    {v < 60 ? `${v} ث` : `${v / 60} د`}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-medium mb-2.5" style={{ color: "var(--text-secondary)" }}>مدت نمایش Toast</h3>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 5, 8, 10].map((v) => (
                  <button key={v} onClick={() => update("toastDuration", v)}
                    className={`py-2.5 rounded text-sm transition ${settings.toastDuration === v ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                    {v} ث
                  </button>
                ))}
              </div>
            </section>
          </div>

          <hr style={{ borderColor: "var(--border-color)" }} />

          {/* Connection */}
          <section>
            <h3 className="text-sm font-medium mb-2.5" style={{ color: "var(--text-secondary)" }}>اتصال به پنل</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "var(--text-secondary)" }}>تایم‌اوت</label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 15, 30, 60].map((v) => (
                    <button key={v} onClick={() => update("panelTimeout", v)}
                      className={`py-2 rounded text-sm transition ${settings.panelTimeout === v ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                      {v}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "var(--text-secondary)" }}>تلاش مجدد</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 5].map((v) => (
                    <button key={v} onClick={() => update("panelRetryAttempts", v)}
                      className={`py-2 rounded text-sm transition ${settings.panelRetryAttempts === v ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                      {v === 0 ? "-" : `${v}x`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ===== Save ===== */}
        <button onClick={saveSettings} disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-2 text-base font-medium shadow-lg">
          {saving ? <Spinner /> : null}
          {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>

      </div>
      </PageTransition>
    </div>
  );
}
