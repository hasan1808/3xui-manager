"use client";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/lib/toast-context";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import { formatPersianDate, formatPersianTime } from "@/lib/persian-date";

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

export default function BackupPage() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<BackupResult[] | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [autoInterval, setAutoInterval] = useState(24);
  const [autoActive, setAutoActive] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSuperadmin = currentUser?.role === "superadmin";

  function loadData() {
    setLoading(true);
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
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function deleteBackup(file: string) {
    const res = await fetch(`/api/backup/panels?file=${encodeURIComponent(file)}`, { method: "DELETE" });
    if (res.ok) {
      toast("بکاپ حذف شد");
      loadData();
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
      loadData();
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

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="پشتیبان‌گیری" />
      <PageTransition>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

        {/* System backup */}
        <div className="rounded-lg p-5 md:p-6 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
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

        {/* Auto backup */}
        {isSuperadmin && (
        <div className="rounded-lg p-5 md:p-6 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
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
              loadData();
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

        {/* Panel backup */}
        <div className="rounded-lg p-5 md:p-6 shadow space-y-4" style={{ background: "var(--bg-secondary)" }}>
          <h2 className="text-lg font-semibold">پنل‌های راه دور</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>بکاپ دیتابیس کامل هر پنل</p>

          {loading ? (
            <div className="text-center py-4"><Spinner /></div>
          ) : panels.length === 0 ? (
            <div className="text-center py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              هیچ پنلی اضافه نشده
            </div>
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
            <div className="text-center py-6 text-sm" style={{ color: "var(--text-secondary)" }}>
              هنوز بکاپی گرفته نشده
            </div>
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
      </PageTransition>
    </div>
  );
}
