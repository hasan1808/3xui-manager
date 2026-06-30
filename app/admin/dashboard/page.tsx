"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/lib/toast-context";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { useConfirm } from "@/lib/confirm-dialog";
import { formatBytes, formatSpeed, formatUptime, extractHost } from "@/lib/utils";
import NavBar from "@/lib/navbar";
import { Spinner, SkeletonCard } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import { useSettings } from "@/lib/use-settings";
import type { DragEvent } from "react";

interface PanelInfo {
  id: string;
  name: string;
  url: string;
  active: boolean;
}

interface PanelStatus {
  cpu?: number;
  mem?: { current: number; total: number };
  disk?: { current: number; total: number };
  xray?: { state: string; version: string };
  version?: string;
  netIO?: { up: number; down: number };
  uptime?: number;
  error?: string;
}

interface PanelDetail {
  totalUp: number;
  totalDown: number;
  onlineCount: number;
  clientCount: number;
}

interface FinanceSummary {
  myBalance: number;
  myUsage: number;
  myDeposits: number;
  myTxnCount: number;
  currency: string;
  adminCount: number;
  isSuperadmin: boolean;
  totalCustomersBalance: number;
  totalCustomersDeposits: number;
  totalUsage: number;
  totalUsageGb: number;
  totalCurrentGb: number;
  myUsageGb: number;
  myCurrentGb: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { settings } = useSettings();
  const [panels, setPanels] = useState<PanelInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PanelStatus>>({});
  const [details, setDetails] = useState<Record<string, PanelDetail>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [myStats, setMyStats] = useState<{ clientCount: number; totalUp: number; totalDown: number; onlineCount: number; panelsOnline: number; panelCount: number } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    fetch("/api/admins/me").then((r) => { if (r.ok) return r.json(); throw new Error(); }).then((u) => { if (u.role !== "superadmin") router.replace("/user"); }).catch(() => router.push("/login"));
    mounted.current = true;
    return () => { mounted.current = false; };
  }, [router]);

  useKeyboardShortcuts({
    "r": () => refreshNow(),
    "Escape": () => {},
  });

  const fetchPanels = useCallback(async () => {
    const res = await fetch("/api/panels");
    if (res.status === 401) { router.push("/login"); return null; }
    const data = await res.json();
    if (!mounted.current) return null;
    setPanels(data);
    return data as PanelInfo[];
  }, [router]);

  const fetchStatuses = useCallback(async (panelsList: PanelInfo[]) => {
    const results = await Promise.allSettled(
      panelsList.map(async (p) => {
        const res = await fetch(`/api/panels/${p.id}/status`);
        if (!res.ok) return { id: p.id, error: `HTTP ${res.status}` };
        const data = await res.json();
        return data.error ? { id: p.id, error: data.error } : { id: p.id, ...data };
      })
    );
    if (!mounted.current) return;
    const newStatuses: Record<string, PanelStatus> = {};
    const newDetails: Record<string, PanelDetail> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const v = r.value;
        newStatuses[v.id] = v.error ? { error: v.error } : v;
        if (!v.error) newDetails[v.id] = { totalUp: 0, totalDown: 0, onlineCount: 0, clientCount: 0 };
      }
    }
    setStatuses(newStatuses);

    const dresults = await Promise.allSettled(
      panelsList.map(async (p) => {
        const res = await fetch(`/api/dashboard/panel-details?panelId=${p.id}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.error) return null;
        return { id: p.id, totalUp: data.totalUp, totalDown: data.totalDown, clientCount: data.clientCount, onlineCount: data.onlineCount };
      })
    );
    if (!mounted.current) return;
    for (const r of dresults) {
      if (r.status === "fulfilled" && r.value) newDetails[r.value.id] = r.value;
    }
    setDetails(newDetails);
    fetch("/api/finance/traffic-history/record", { method: "POST" }).catch(() => {});
  }, []);

  const loadMyStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/my-stats");
      if (res.ok) setMyStats(await res.json());
    } catch {}
  }, []);

  const loadFinanceSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/summary");
      if (res.ok) setFinanceSummary(await res.json());
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    const p = await fetchPanels();
    if (p) {
      await fetchStatuses(p);
    }
      await loadMyStats();
    await loadFinanceSummary();
  }, [fetchPanels, fetchStatuses, loadMyStats, loadFinanceSummary]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { fetch("/api/backup/init").catch(() => {}); }, []);
  useEffect(() => {
    const interval = setInterval(loadAll, (settings.dashboardRefreshInterval || 30) * 1000);
    return () => clearInterval(interval);
  }, [loadAll, settings.dashboardRefreshInterval]);

  async function refreshNow() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast("بروزرسانی شد");
  }

  async function reorderPanels(panelsList: PanelInfo[]) {
    await fetch("/api/panels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: panelsList.map((p) => p.id) }),
    }).catch(() => {});
  }

  function onDragStart(e: DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const copy = [...panels];
    const fromIdx = copy.findIndex((p) => p.id === dragId);
    const toIdx = copy.findIndex((p) => p.id === targetId);
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setPanels(copy);
    reorderPanels(copy);
    setDragId(null);
  }

  const onlinePanels = panels.filter((p) => !statuses[p.id]?.error).length;
  const calcTotalClients = () => Object.values(details).reduce((s, d) => s + d.clientCount, 0);
  const calcTotalUp = () => Object.values(details).reduce((s, d) => s + d.totalUp, 0);
  const calcTotalDown = () => Object.values(details).reduce((s, d) => s + d.totalDown, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="داشبورد" />

      <div className="p-3 sm:p-6 max-w-6xl mx-auto">
        <PageTransition>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={refreshNow} disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition">
            {refreshing ? <><Spinner /> بروزرسانی</> : "بروزرسانی"}
          </button>
          <span className="text-xs text-gray-500">(R - هر {settings.dashboardRefreshInterval || 30} ثانیه)</span>
        </div>

          <h1 className="sr-only">داشبورد</h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
            <p className="text-gray-400 text-xs mb-1">پنل‌ها</p>
            <p className="text-2xl font-bold">{myStats ? `${myStats.panelsOnline}/${myStats.panelCount}` : `${onlinePanels}/${panels.length}`}</p>
            <p className="text-green-400 text-xs">{myStats ? "آنلاین من" : "آنلاین"}</p>
          </div>
          <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
            <p className="text-gray-400 text-xs mb-1">کاربران</p>
            <p className="text-2xl font-bold">{myStats?.clientCount ?? calcTotalClients()}</p>
            <p className={myStats ? "text-green-400 text-xs" : "text-blue-400 text-xs"}>{myStats ? "کاربران من" : "کل کاربران"}</p>
          </div>
          <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
            <p className="text-gray-400 text-xs mb-1">کل مصرف</p>
            <p className="text-2xl font-bold">{formatBytes(myStats ? (myStats.totalUp + myStats.totalDown) : (calcTotalUp() + calcTotalDown()))}</p>
            <p className={myStats ? "text-green-400 text-xs" : "text-yellow-400 text-xs"}>{myStats ? "مصرف من" : "مجموع ترافیک"}</p>
          </div>
          <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
            <p className="text-gray-400 text-xs mb-1">آنلاین</p>
            <p className="text-2xl font-bold">{myStats?.onlineCount ?? Object.values(details).reduce((s, d) => s + d.onlineCount, 0)}</p>
            <p className="text-green-400 text-xs">{myStats ? "آنلاین من" : "کاربران آنلاین"}</p>
          </div>
        </div>

        {financeSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-gray-400 text-xs mb-1">{financeSummary.isSuperadmin ? "مجموع موجودی مشتری‌ها" : "موجودی کیف‌پول"}</p>
              <p className="text-2xl font-bold text-green-400">{(financeSummary.isSuperadmin ? financeSummary.totalCustomersBalance : financeSummary.myBalance).toLocaleString("en-US")}</p>
              <p className="text-gray-500 text-xs">{financeSummary.currency}</p>
            </div>
            <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-gray-400 text-xs mb-1">{financeSummary.isSuperadmin ? "شارژ مشتری‌ها" : "شارژ/واریزی"}</p>
              <p className="text-2xl font-bold text-blue-400">{(financeSummary.isSuperadmin ? financeSummary.totalCustomersDeposits : financeSummary.myDeposits).toLocaleString("en-US")}</p>
              <p className="text-gray-500 text-xs">{financeSummary.currency}</p>
            </div>
            <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-gray-400 text-xs mb-1">{financeSummary.isSuperadmin ? "مصرف مشتری‌ها" : "مصرف"}</p>
              <p className="text-2xl font-bold text-red-400">
                {(financeSummary.isSuperadmin ? financeSummary.totalCurrentGb : financeSummary.myCurrentGb).toFixed(2)} GB
              </p>
              {(financeSummary.isSuperadmin ? financeSummary.totalUsage : financeSummary.myUsage) !== 0 && (
                <p className="text-gray-500 text-xs">
                  {Math.abs(financeSummary.isSuperadmin ? financeSummary.totalUsage : financeSummary.myUsage).toLocaleString("en-US")} {financeSummary.currency}
                </p>
              )}
            </div>
            {financeSummary.isSuperadmin && (
              <div className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl cursor-pointer" style={{ background: "var(--bg-secondary)" }}
                onClick={() => router.push("/admin/admins")}>
                <p className="text-gray-400 text-xs mb-1">تعداد مشتری</p>
                <p className="text-2xl font-bold text-purple-400">{financeSummary.adminCount}</p>
                <p className="text-purple-400 text-xs">مشتری‌ها</p>
              </div>
            )}
          </div>
        )}



        <h2 className="text-lg font-semibold mb-4">وضعیت پنل‌ها</h2>
        <div className="space-y-3">
          {panels.map((panel) => {
            const st = statuses[panel.id];
            const det = details[panel.id];
            return (
              <div key={panel.id} className="rounded-lg p-5 shadow transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}
                draggable onDragStart={(e) => onDragStart(e, panel.id)} onDragOver={onDragOver} onDrop={(e) => onDrop(e, panel.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-500 cursor-grab text-sm">⠿</span>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${st?.xray?.state === "running" ? "bg-green-500" : st?.error ? "bg-red-500" : "bg-gray-500"}`} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{panel.name}</p>
                      <p className="text-gray-500 text-xs font-mono truncate" dir="ltr">{extractHost(panel.url)}</p>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/admin/panels/${panel.id}`)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm transition shrink-0">
                    مدیریت
                  </button>
                </div>

                {st?.error ? (
                  <p className="text-red-400 text-sm">{st.error}</p>
                ) : st ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 text-sm">
                    <div className="rounded p-3 text-center" style={{ background: "var(--bg-tertiary)" }}>
                      <p className="text-gray-400 text-xs">Xray</p>
                      <p className={`font-medium ${st.xray?.state === "running" ? "text-green-400" : "text-red-400"}`}>
                        {st.xray?.state === "running" ? "Running" : "Stopped"}
                      </p>
                      <p className="text-gray-500 text-xs">{st.xray?.version || ""}</p>
                      <p className="text-gray-500 text-xs mt-1">{formatUptime(st.uptime!)}</p>
                      {st.version && <p className="text-gray-500 text-xs mt-1">Panel: {st.version}</p>}
                    </div>
                    <div className="rounded p-3 text-center" style={{ background: "var(--bg-tertiary)" }}>
                      <p className="text-gray-400 text-xs">سرور</p>
                      <p className="text-sm font-mono font-bold text-blue-400 truncate max-w-[120px] mx-auto" dir="ltr">{extractHost(panel.url)}</p>
                      <p className="text-green-400 text-xs">{det?.onlineCount || 0} online</p>
                    </div>
                    <div className="rounded p-3 text-center" style={{ background: "var(--bg-tertiary)" }}>
                      <p className="text-gray-400 text-xs">سرعت</p>
                      <p className="text-sm font-medium text-green-400">↑{formatSpeed(st.netIO?.up || 0)}</p>
                      <p className="text-sm font-medium text-blue-400">↓{formatSpeed(st.netIO?.down || 0)}</p>
                    </div>
                    <div className="rounded p-3 text-center" style={{ background: "var(--bg-tertiary)" }}>
                      <p className="text-gray-400 text-xs">مصرف</p>
                      <p className="text-sm font-medium text-yellow-400">↑{formatBytes(det?.totalUp || 0)}</p>
                      <p className="text-sm font-medium text-yellow-400">↓{formatBytes(det?.totalDown || 0)}</p>
                    </div>
                    <div className="rounded p-3 text-center" style={{ background: "var(--bg-tertiary)" }}>
                      <p className="text-gray-400 text-xs">کاربران</p>
                      <p className="text-lg font-bold">{det?.clientCount || 0}</p>
                      <p className="text-gray-500 text-xs">کل</p>
                    </div>
                  </div>
                ) : (
                  <SkeletonCard />
                )}
              </div>
            );
          })}
          {panels.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>هیچ پنلی اضافه نشده است</p>
              {financeSummary?.isSuperadmin && (
                <button onClick={() => router.push("/admin/panels")}
                  className="mt-3 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded inline-block transition">
                  افزودن پنل
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          <a href="https://github.com/hasan1808/3xui-manager" target="_blank" rel="noopener noreferrer"
            className="hover:text-blue-400 transition">GitHub</a>
          <span className="mx-2">|</span>
          <span>3xui-manager v1.1</span>
        </div>

        </PageTransition>
      </div>
    </div>
  );
}
