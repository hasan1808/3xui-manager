"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/lib/toast-context";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import { formatPersianDateTime } from "@/lib/persian-date";

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
}

const actionLabels: Record<string, string> = {
  add_client: "افزودن کاربر",
  edit_client: "ویرایش کاربر",
  delete_client: "حذف کاربر",
  toggle_client: "تغییر وضعیت کاربر",
  reset_traffic: "ریست ترافیک",
  create_inbound: "ایجاد اینباند",
  toggle_inbound: "تغییر وضعیت اینباند",
  edit_inbound: "ویرایش اینباند",
  delete_inbound: "حذف اینباند",
  add_panel: "افزودن پنل",
  edit_panel: "ویرایش پنل",
  delete_panel: "حذف پنل",
  reorder_panels: "مرتب‌سازی پنل‌ها",
  db_backup: "بکاپ دیتابیس",
  db_restore: "بازیابی بکاپ",
  system_backup: "بکاپ سیستم",
  system_restore: "بازیابی سیستم",
  auto_backup: "بکاپ خودکار",
  settings_change: "تغییر تنظیمات",
  login: "ورود",
  logout: "خروج",
};

export default function LogsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const isSuperadmin = currentUser?.role === "superadmin";
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
    fetch("/api/admins/me").then((r) => r.json()).then(setCurrentUser).catch(() => {});
  }, []);

  useKeyboardShortcuts({
    "Escape": () => router.push("/admin/dashboard"),
  });

  async function fetchLogs(pg?: number) {
    setLoading(true);
    const p = pg ?? page;
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filter) params.set("search", filter);
      const res = await fetch(`/api/logs?${params}`);
      if (res.status === 401) { router.push("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } catch {}
    setLoading(false);
  }

  async function clearLogs() {
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
        toast("لاگ‌ها پاک شد");
      } else {
        toast("خطا در پاک کردن", "error");
      }
    } catch { toast("خطا در پاک کردن", "error"); }
  }

  function formatAction(action: string): string {
    return actionLabels[action] || action;
  }

  function formatTime(ts: string): string {
    try {
      return formatPersianDateTime(ts);
    } catch {
      return ts;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="سابقه عملیات" />

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <PageTransition>
          <div className="space-y-5">

            {/* filter bar */}
            <div className="rounded-lg p-4 shadow flex flex-wrap items-center gap-3" style={{ background: "var(--bg-secondary)" }}>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="جستجو در عملیات و جزئیات..."
                className="rounded px-3 py-2 text-sm border outline-none flex-1 min-w-[200px]"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
              />
              <button onClick={() => fetchLogs(1)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">
                بروزرسانی
              </button>
              {isSuperadmin && (
                <button onClick={clearLogs} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition">
                  پاک کردن همه
                </button>
              )}
            </div>

            {/* logs */}
            {loading ? (
              <div className="text-center py-16"><Spinner /></div>
            ) : logs.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--bg-secondary)" }}>
                <div className="text-3xl mb-2 text-gray-500">📋</div>
                <div className="text-gray-400">هیچ لاگی ثبت نشده</div>
              </div>
            ) : (
              <div className="rounded-lg shadow overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                  {logs.map((log) => (
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
                            {formatAction(log.action)}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatTime(log.timestamp)}</span>
                        </div>
                        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{log.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 flex items-center justify-between text-xs border-t" style={{ color: "var(--text-secondary)", borderColor: "var(--border-color)" }}>
                  <span>{total} رکورد</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button disabled={page <= 1} onClick={() => fetchLogs(page - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>‹ قبل</button>
                      <span>صفحه {page} از {totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:opacity-80 transition" style={{ background: "var(--bg-tertiary)" }}>بعد ›</button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </PageTransition>
      </div>
    </div>
  );
}
