"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast-context";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

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

  useEffect(() => {
    fetchLogs();
  }, []);

  useKeyboardShortcuts({
    "Escape": () => router.push("/dashboard"),
  });

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/logs");
      if (res.status === 401) { router.push("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {}
    setLoading(false);
  }

  async function clearLogs() {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setLogs([]);
      toast("لاگ‌ها پاک شد");
    } catch { toast("خطا در پاک کردن", "error"); }
  }

  const filtered = logs.filter(
    (l) =>
      !filter ||
      l.action.toLowerCase().includes(filter.toLowerCase()) ||
      l.detail.toLowerCase().includes(filter.toLowerCase())
  );

  function formatAction(action: string): string {
    return actionLabels[action] || action;
  }

  function formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleString("fa-IR");
    } catch {
      return ts;
    }
  }

  function getActionColor(action: string): string {
    if (action.includes("delete") || action.includes("حذف")) return "text-red-400";
    if (action.includes("add") || action.includes("افزودن")) return "text-green-400";
    if (action.includes("edit") || action.includes("ویرایش")) return "text-yellow-400";
    if (action.includes("panel") || action.includes("پنل")) return "text-cyan-400";
    if (action.includes("backup") || action.includes("بکاپ")) return "text-blue-400";
    if (action.includes("restore") || action.includes("بازیابی")) return "text-purple-400";
    return "text-gray-400";
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="سابقه عملیات" />

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        <PageTransition>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="جستجو..."
              className="rounded px-3 py-2 text-sm border outline-none flex-1 min-w-[200px]"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
            />
            <button onClick={fetchLogs} className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-sm transition">
              بروزرسانی
            </button>
            <button onClick={clearLogs} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition">
              پاک کردن همه
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">هیچ لاگی ثبت نشده</div>
          ) : (
            <div className="rounded-lg shadow overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-tertiary)" }}>
                      <th className="p-3 text-right">تاریخ</th>
                      <th className="p-3 text-right">عملیات</th>
                      <th className="p-3 text-right">جزئیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => (
                      <tr key={log.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                        <td className="p-3 whitespace-nowrap text-xs">{formatTime(log.timestamp)}</td>
                        <td className={`p-3 font-medium ${getActionColor(log.action)}`}>{formatAction(log.action)}</td>
                        <td className="p-3 text-gray-400 text-xs">{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 text-center text-xs text-gray-500 border-t" style={{ borderColor: "var(--border-color)" }}>
                {filtered.length} رکورد از {logs.length}
              </div>
            </div>
          )}
        </PageTransition>
      </div>
    </div>
  );
}
