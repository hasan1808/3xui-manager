"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import { useToast } from "@/lib/toast-context";
import { formatPersianDate, formatPersianTime, formatPersianDateTime } from "@/lib/persian-date";

interface BackupFile {
  file: string;
  date: string;
  panelId: string;
  panelName: string;
}

interface Panel {
  id: string;
  name: string;
  url: string;
}

interface BackupResult {
  panelId: string;
  panelName: string;
  ok: boolean;
  error?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "backup" | "logs">("settings");

  const [backingUp, setBackingUp] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [backupLoading, setBackupLoading] = useState(true);
  const [results, setResults] = useState<BackupResult[] | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [autoInterval, setAutoInterval] = useState(24);
  const [autoActive, setAutoActive] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logFilter, setLogFilter] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(0);
  const logPageSize = 50;

  const [serverPort, setServerPort] = useState("");
  const [newPort, setNewPort] = useState("");
  const [restarting, setRestarting] = useState(false);

  const isSuperadmin = currentUser?.role === "superadmin";

  function loadBackupData() {
    setBackupLoading(true);
    Promise.all([
      fetch("/api/backup/panels").then((r) => r.json()),
      fetch("/api/panels").then((r) => r.json()),
      fetch("/api/backup/auto").then((r) => r.json()).catch(() => ({ enabled: false, active: false })),
      fetch("/api/admins/me").then((r) => r.json()).catch(() => ({})),
    ]).then(([backupList, panelList, autoStatus, user]) => {
      setBackups(backupList);
      setPanels(panelList);
      setAutoBackup(autoStatus.enabled || false);
      setAutoInterval(autoStatus.intervalHours || 24);
      setAutoActive(autoStatus.active || false);
      setCurrentUser(user);
      setBackupLoading(false);
    }).catch(() => setBackupLoading(false));
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings).catch(() => router.push("/login"));
    loadBackupData();
    fetch("/api/settings/port", { credentials: "include" }).then((r) => r.json()).then((d) => setServerPort(d.port)).catch(() => {});
  }, [router]);

  const actionLabels: Record<string, string> = {
    add_client: "افزودن کاربر", edit_client: "ویرایش کاربر", delete_client: "حذف کاربر",
    toggle_client: "تغییر وضعیت کاربر", reset_traffic: "ریست ترافیک",
    create_inbound: "ایجاد اینباند", toggle_inbound: "تغییر وضعیت اینباند",
    edit_inbound: "ویرایش اینباند", delete_inbound: "حذف اینباند",
    add_panel: "افزودن پنل", edit_panel: "ویرایش پنل", delete_panel: "حذف پنل",
    reorder_panels: "مرتب‌سازی پنل‌ها", db_backup: "بکاپ دیتابیس", db_restore: "بازیابی بکاپ",
    system_backup: "بکاپ سیستم", system_restore: "بازیابی سیستم", auto_backup: "بکاپ خودکار",
    settings_change: "تغییر تنظیمات", login: "ورود", logout: "خروج",
  };

  async function fetchLogs(pg?: number) {
    setLogLoading(true);
    const p = pg ?? logPage;
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(logPageSize) });
      if (logFilter) params.set("search", logFilter);
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items);
        setLogTotal(data.total);
        setLogTotalPages(data.totalPages);
        setLogPage(data.page);
      }
    } catch {}
    setLogLoading(false);
  }

  async function changePort() {
    if (!newPort) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/port", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: newPort }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message);
        const targetPort = newPort;
        setNewPort("");
        setTimeout(() => {
          window.location.href = `${window.location.protocol}//${window.location.hostname}:${targetPort}/admin/settings`;
        }, 2000);
      } else {
        toast(data.error || "خطا", "error");
      }
    } catch { toast("خطا", "error"); }
    setSaving(false);
  }

  async function restartServer() {
    setRestarting(true);
    try {
      const res = await fetch("/api/settings/restart", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast("سرویس ریستارت شد. چند لحظه صبر کنید...");
        setTimeout(() => window.location.reload(), 5000);
      } else {
        toast(data.error || "خطا", "error");
      }
    } catch { toast("خطا در ریستارت", "error"); }
    setRestarting(false);
  }

  async function clearLogs() {
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) { setLogs([]); toast("لاگ‌ها پاک شد"); }
      else { toast("خطا در پاک کردن", "error"); }
    } catch { toast("خطا در پاک کردن", "error"); }
  }

  async function save(key: string, value: any) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSettings({ ...settings, [key]: value });
    setSaving(false);
  }

  async function deleteBackup(file: string) {
    const res = await fetch(`/api/backup/panels?file=${encodeURIComponent(file)}`, { method: "DELETE" });
    if (res.ok) {
      toast("بکاپ حذف شد");
      loadBackupData();
    } else {
      toast("خطا در حذف", "error");
    }
  }

  async function restoreBackup(file: string, panelId: string) {
    setRestoring(file);
    try {
      const restoreRes = await fetch("/api/backup/panels/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelId, file }),
      });
      const result = await restoreRes.json();
      if (restoreRes.ok) {
        toast("بازیابی با موفقیت انجام شد");
      } else {
        toast(result.error || "خطا در بازیابی", "error");
      }
    } catch (e: any) {
      toast("خطا در بازیابی: " + e.message, "error");
    } finally {
      setRestoring(null);
    }
  }

  async function takeBackup(panelId: string | null) {
    const id = panelId || "all";
    setBackingUp(id);
    setResults(null);
    const body: any = {};
    if (panelId) body.panelId = panelId;
    const res = await fetch("/api/backup/panels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBackingUp(null);
    if (res.ok) {
      setResults(data.results);
      const ok = data.results.filter((r: BackupResult) => r.ok).length;
      toast(`بکاپ: ${ok} موفق از ${data.results.length} پنل`);
      loadBackupData();
    } else {
      toast("خطا در پشتیبان‌گیری", "error");
    }
  }

  const groups = new Map<string, BackupFile[]>();
  for (const b of backups) {
    const key = b.panelId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  if (!settings) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <NavBar title="تنظیمات" backTo="/admin/dashboard" />
        <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="تنظیمات" backTo="/admin/dashboard" />
      <div className="p-3 sm:p-6 max-w-2xl mx-auto">
        <div className="flex mb-4 bg-gray-800 rounded-lg p-1">
          <button onClick={() => setActiveTab("settings")}
            className={`flex-1 py-2 rounded-lg text-sm transition ${activeTab === "settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
            تنظیمات عمومی
          </button>
          <button onClick={() => setActiveTab("backup")}
            className={`flex-1 py-2 rounded-lg text-sm transition ${activeTab === "backup" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
            پشتیبان‌گیری
          </button>
          <button onClick={() => { setActiveTab("logs"); fetchLogs(1); }}
            className={`flex-1 py-2 rounded-lg text-sm transition ${activeTab === "logs" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
            سابقه عملیات
          </button>
        </div>

        <PageTransition>
          {activeTab === "settings" && (
            <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex items-center justify-between">
                <label className="text-sm">فاصله بروزرسانی داشبورد (ثانیه)</label>
                <input type="number" value={settings.dashboardRefreshInterval} min="5" max="300"
                  onChange={(e) => setSettings({ ...settings, dashboardRefreshInterval: parseInt(e.target.value) })}
                  onBlur={(e) => save("dashboardRefreshInterval", parseInt(e.target.value))}
                  className="p-2 rounded border outline-none text-sm w-20 text-left" dir="ltr"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">مدت نمایش Toast (ثانیه)</label>
                <input type="number" value={settings.toastDuration} min="1" max="30"
                  onChange={(e) => setSettings({ ...settings, toastDuration: parseInt(e.target.value) })}
                  onBlur={(e) => save("toastDuration", parseInt(e.target.value))}
                  className="p-2 rounded border outline-none text-sm w-20 text-left" dir="ltr"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">Timeout پنل (ثانیه)</label>
                <input type="number" value={settings.panelTimeout} min="3" max="60"
                  onChange={(e) => setSettings({ ...settings, panelTimeout: parseInt(e.target.value) })}
                  onBlur={(e) => save("panelTimeout", parseInt(e.target.value))}
                  className="p-2 rounded border outline-none text-sm w-20 text-left" dir="ltr"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">تلاش مجدد پنل</label>
                <input type="number" value={settings.panelRetryAttempts} min="0" max="10"
                  onChange={(e) => setSettings({ ...settings, panelRetryAttempts: parseInt(e.target.value) })}
                  onBlur={(e) => save("panelRetryAttempts", parseInt(e.target.value))}
                  className="p-2 rounded border outline-none text-sm w-20 text-left" dir="ltr"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="rounded-lg p-5 shadow space-y-4 mt-4" style={{ background: "var(--bg-secondary)" }}>
              <h2 className="text-lg font-semibold">مدیریت سرور</h2>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">پورت سرور</label>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>پورت فعلی: {serverPort || "..."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={newPort} min="1" max="65535" placeholder={serverPort || "3000"}
                    onChange={(e) => setNewPort(e.target.value)}
                    className="p-2 rounded border outline-none text-sm w-20 text-left" dir="ltr"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                  <button onClick={changePort} disabled={saving || !newPort}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm transition">
                    {saving ? "..." : "تغییر پورت"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">ریستارت سرور</label>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>سرویس 3xui-manager را مجدداً راه‌اندازی کنید</p>
                </div>
                <button onClick={restartServer} disabled={restarting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm transition flex items-center gap-2">
                  {restarting && <Spinner />}
                  {restarting ? "در حال ریستارت..." : "ریستارت"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="space-y-4">
              <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
                <h2 className="text-lg font-semibold">سیستم</h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>خروجی کامل تمام فایل‌های داده (ZIP)</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <a href="/api/backup" target="_blank"
                    className="py-3 bg-blue-600 hover:bg-blue-700 rounded text-sm text-center transition block">
                    دانلود پشتیبان (ZIP)
                  </a>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".zip,.json" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const arrayBuffer = await file.arrayBuffer();
                          const res = await fetch("/api/backup", {
                            method: "POST",
                            headers: { "Content-Type": "application/octet-stream" },
                            body: arrayBuffer,
                          });
                          const data = await res.json();
                          if (res.ok) {
                            toast(data.message || "پشتیبان با موفقیت بازیابی شد");
                            setTimeout(() => window.location.reload(), 1000);
                          } else {
                            toast(data.error || "خطا در بازیابی", "error");
                          }
                        } catch (err: any) {
                          toast("خطا: " + err.message, "error");
                        }
                        e.target.value = "";
                      }} />
                    <button onClick={() => fileRef.current?.click()}
                      className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 rounded text-sm transition flex items-center justify-center gap-2"
                      disabled={!isSuperadmin}>
                      بازیابی از فایل
                    </button>
                  </div>
                </div>
              </div>

              {isSuperadmin && (
                <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
                  <h2 className="text-lg font-semibold">پشتیبان‌گیری خودکار</h2>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={autoBackup}
                      onChange={(e) => setAutoBackup(e.target.checked)}
                      className="w-4 h-4 rounded" style={{ background: "var(--bg-tertiary)" }} />
                    <span className="text-sm">فعال‌سازی بکاپ خودکار</span>
                    {autoActive && <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">فعال - هر {autoInterval} ساعت</span>}
                  </label>
                  {autoBackup && (
                    <div className="grid grid-cols-5 gap-2 max-w-sm">
                      {[1, 6, 12, 24, 48].map((v) => (
                        <button key={v} onClick={() => setAutoInterval(v)}
                          className={`py-2 rounded text-sm transition ${autoInterval === v ? "bg-blue-600 text-white shadow-md" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                          {v < 24 ? `${v}h` : `${v / 24}d`}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      await fetch("/api/backup/auto", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ enabled: autoBackup, intervalHours: autoInterval }),
                      });
                      toast(autoBackup ? "بکاپ خودکار فعال شد" : "بکاپ خودکار غیرفعال شد");
                      loadBackupData();
                    }} className="py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">ذخیره</button>
                    <button onClick={async () => {
                      await fetch("/api/backup/auto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trigger" }) });
                      toast("بکاپ شروع شد");
                    }} className="py-2 px-4 bg-green-600 hover:bg-green-700 rounded text-sm transition">بکاپ الان</button>
                    <button onClick={async () => {
                      const res = await fetch("/api/backup/auto").then(r => r.json());
                      toast(res.active ? `تایمر فعاله - هر ${res.intervalHours} ساعت` : "تایمر غیرفعاله");
                    }} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-sm transition">وضعیت</button>
                  </div>
                </div>
              )}

              <div className="rounded-lg p-5 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
                <h2 className="text-lg font-semibold">پنل‌های راه دور</h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>بکاپ دیتابیس کامل هر پنل</p>
                {backupLoading ? (
                  <div className="text-center py-4"><Spinner /></div>
                ) : panels.length === 0 ? (
                  <div className="text-center py-4 text-sm" style={{ color: "var(--text-secondary)" }}>هیچ پنلی اضافه نشده</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-end gap-2 pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
                      <button onClick={() => takeBackup(null)} disabled={backingUp !== null}
                        className="py-2 px-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded text-xs transition flex items-center gap-1">
                        {backingUp === "all" ? <Spinner /> : null}
                        بکاپ همه
                      </button>
                    </div>
                    {panels.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded px-3 py-2"
                        style={{ background: "var(--bg-tertiary)" }}>
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <span>📦</span>
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="text-xs truncate hidden sm:inline" style={{ color: "var(--text-secondary)" }} dir="ltr">{p.url}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => takeBackup(p.id)} disabled={backingUp !== null}
                            className="py-1.5 px-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded text-xs transition flex items-center gap-1">
                            {backingUp === p.id ? <Spinner /> : null}
                            بکاپ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <hr style={{ borderColor: "var(--border-color)" }} />
                {results && results.length > 0 && (
                  <div className="space-y-1.5">
                    {results.map((r) => (
                      <div key={r.panelId} className="rounded px-3 py-2 text-xs flex items-center gap-2"
                        style={{ background: "var(--bg-tertiary)" }}>
                        <span>{r.ok ? "✅" : "❌"}</span>
                        <span className="font-medium">{r.panelName}</span>
                        {!r.ok && r.error && <span className="text-red-400 truncate">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <hr style={{ borderColor: "var(--border-color)" }} />
                <h3 className="text-sm font-medium">بکاپ‌های ذخیره شده</h3>
                {backups.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: "var(--text-secondary)" }}>هنوز بکاپی گرفته نشده</div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(groups.entries()).map(([panelId, files]) => (
                      <div key={panelId}>
                        <h4 className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                          <span>📦</span>
                          <span>{files[0].panelName}</span>
                          <span className="text-xs">({files.length} فایل)</span>
                        </h4>
                        <div className="space-y-1">
                          {files.map((b) => {
                            const d = new Date(b.date);
                            const dateStr = formatPersianDate(d) + " " + formatPersianTime(d);
                            const filename = b.file.split("/").pop() || "";
                            return (
                              <div key={b.file} className="flex items-center justify-between rounded px-3 py-2 text-sm"
                                style={{ background: "var(--bg-tertiary)" }}>
                                <div className="flex items-center gap-3 truncate flex-1">
                                  <span className="text-gray-400">📄</span>
                                  <span dir="ltr" className="truncate">{dateStr}</span>
                                  <span className="text-xs opacity-50" dir="ltr">{filename}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <a href={`/api/backup/panels?file=${encodeURIComponent(b.file)}&download=1`} target="_blank"
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition">📥</a>
                                  {isSuperadmin && (
                                    <>
                                      <button onClick={() => restoreBackup(b.file, b.panelId)} disabled={restoring === b.file}
                                        className="px-2 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-xs transition flex items-center gap-1">
                                        {restoring === b.file ? <Spinner /> : null}
                                        ♻️
                                      </button>
                                      <button onClick={() => deleteBackup(b.file)}
                                        className="px-2 py-1 bg-red-700 hover:bg-red-800 rounded text-xs transition">🗑️</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-4">
              <div className="rounded-lg p-4 shadow flex flex-wrap items-center gap-3" style={{ background: "var(--bg-secondary)" }}>
                <input value={logFilter} onChange={(e) => setLogFilter(e.target.value)}
                  placeholder="جستجو در عملیات و جزئیات..."
                  className="rounded px-3 py-2 text-sm border outline-none flex-1 min-w-[200px]"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                <button onClick={() => fetchLogs(1)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">بروزرسانی</button>
                {isSuperadmin && (
                  <button onClick={clearLogs} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition">پاک کردن همه</button>
                )}
              </div>
              {logLoading ? (
                <div className="text-center py-16"><Spinner /></div>
              ) : logs.length === 0 ? (
                <div className="rounded-lg p-8 text-center" style={{ background: "var(--bg-secondary)" }}>
                  <div className="text-3xl mb-2 text-gray-500">📋</div>
                  <div className="text-gray-400">هیچ لاگی ثبت نشده</div>
                </div>
              ) : (
                <div className="rounded-lg shadow overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                  <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    {logs.map((log: any) => (
                      <div key={log.id} className="p-4 flex items-start gap-3 transition hover:bg-black/10"
                        style={{ borderColor: "var(--border-color)" }}>
                        <div className="shrink-0 w-2 h-2 mt-1.5 rounded-full"
                          style={{
                            background: log.action.includes("delete") ? "#f87171"
                              : log.action.includes("add") ? "#4ade80"
                              : log.action.includes("edit") ? "#facc15"
                              : log.action.includes("panel") ? "#22d3ee"
                              : log.action.includes("backup") ? "#60a5fa"
                              : log.action.includes("restore") ? "#a78bfa"
                              : log.action.includes("login") || log.action.includes("logout") ? "#94a3b8"
                              : "#6b7280"
                          }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium
                              ${log.action.includes("delete") ? "bg-red-600/20 text-red-400"
                                : log.action.includes("add") ? "bg-green-600/20 text-green-400"
                                : log.action.includes("edit") ? "bg-yellow-600/20 text-yellow-400"
                                : log.action.includes("panel") ? "bg-cyan-600/20 text-cyan-400"
                                : log.action.includes("backup") ? "bg-blue-600/20 text-blue-400"
                                : log.action.includes("restore") ? "bg-purple-600/20 text-purple-400"
                                : log.action.includes("login") || log.action.includes("logout") ? "bg-gray-600/20 text-gray-400"
                                : "bg-gray-600/20 text-gray-400"}`}>
                              {actionLabels[log.action] || log.action}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {(() => { try { return formatPersianDateTime(log.timestamp); } catch { return log.timestamp; } })()}
                            </span>
                          </div>
                          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{log.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs border-t" style={{ color: "var(--text-secondary)", borderColor: "var(--border-color)" }}>
                    <span>{logTotal} رکورد</span>
                    {logTotalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button disabled={logPage <= 1} onClick={() => fetchLogs(logPage - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>‹ قبل</button>
                        <span>صفحه {logPage} از {logTotalPages}</span>
                        <button disabled={logPage >= logTotalPages} onClick={() => fetchLogs(logPage + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>بعد ›</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && saving && <p className="text-xs text-gray-500 text-center mt-2">در حال ذخیره...</p>}
        </PageTransition>
      </div>
    </div>
  );
}
