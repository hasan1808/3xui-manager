"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast-context";
import { useKeyboardShortcuts } from "@/lib/keyboard";
import { useConfirm } from "@/lib/confirm-dialog";
import NavBar from "@/lib/navbar";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";
import type { FormEvent, DragEvent } from "react";
import { formatPersianDate } from "@/lib/persian-date";

interface Panel {
  id: string;
  name: string;
  url: string;
  username?: string;
  apiToken?: string;
  subUri?: string;
  active: boolean;
  createdAt: string;
  ownerId?: string;
}

interface AdminInfo {
  id: string;
  username: string;
  role: string;
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [subUri, setSubUri] = useState("");
  const [clientUrl, setClientUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [panelDetails, setPanelDetails] = useState<Record<string, { clientCount: number; onlineCount: number }>>({});
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useKeyboardShortcuts({ "Escape": () => { setShowForm(false); resetForm(); } });

  async function fetchPanels() {
    const res = await fetch("/api/panels");
    if (res.status === 401) return router.push("/login");
    setPanels(await res.json());
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admins/me");
      const data = await res.json();
      if (data.role !== "superadmin") {
        router.push("/user");
        return;
      }
      fetchPanels();
      const aRes = await fetch("/api/admins");
      if (aRes.ok) setAdmins(await aRes.json());
    })();
  }, []);

  useEffect(() => {
    if (panels.length === 0) return;
    panels.forEach(async (p) => {
      try {
        const res = await fetch(`/api/panels/${p.id}/proxy/panel/api/inbounds/list`);
        if (!res.ok) return;
        const data = await res.json();
        const list = data.obj || [];
        let clientCount = 0;
        for (const inb of list) {
          try {
            const s = typeof inb.settings === "string" ? JSON.parse(inb.settings) : inb.settings;
            clientCount += s?.clients?.length || 0;
          } catch {}
        }
        const onlineRes = await fetch(`/api/panels/${p.id}/onlines`);
        const onlineData = onlineRes.ok ? await onlineRes.json() : { count: 0 };
        setPanelDetails((prev) => ({ ...prev, [p.id]: { clientCount, onlineCount: onlineData.count || 0 } }));
      } catch {}
    });
  }, [panels]);

  function resetForm() {
    setName(""); setUrl(""); setUsername(""); setPassword(""); setApiToken(""); setSubUri(""); setClientUrl(""); setOwnerId("");
    setEditId(null); setShowForm(false); setTestResult(null);
  }

  function openEdit(panel: Panel) {
    setEditId(panel.id);
    setName(panel.name);
    setUrl(panel.url);
    setUsername(panel.username || "");
    setPassword("");
    setApiToken(panel.apiToken || "");
    setSubUri(panel.subUri || "");
    setClientUrl(panel.clientUrl || "");
    setOwnerId(panel.ownerId || "");
    setShowForm(true);
    setTestResult(null);
  }

  async function testConnection() {
    if (!url) { toast("آدرس پنل را وارد کنید", "error"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/panels/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: data.msg });
        toast("اتصال موفق", "success");
      } else {
        setTestResult({ ok: false, msg: data.msg });
        toast("خطا در اتصال", "error");
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || "خطا" });
      toast("خطا در اتصال", "error");
    }
    setTesting(false);
  }

  async function savePanel(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, any> = { name, url, username, password: password || undefined, apiToken: apiToken || undefined, subUri: subUri || undefined, clientUrl: clientUrl || undefined, active: true };
    if (ownerId) body.ownerId = ownerId;
    const res = editId
      ? await fetch(`/api/panels/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/panels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      toast(editId ? "ویرایش شد" : "افزوده شد");
      resetForm();
      fetchPanels();
    } else {
      toast("خطا در ذخیره", "error");
    }
  }

  async function removePanel(id: string) {
    const ok = await confirm({ title: "حذف پنل", message: "پنل حذف شود؟", variant: "danger" });
    if (!ok) return;
    const res = await fetch(`/api/panels/${id}`, { method: "DELETE" });
    if (res.ok) { toast("حذف شد"); fetchPanels(); }
    else toast("خطا", "error");
  }

  async function reorderPanels(panelsList: Panel[]) {
    await fetch("/api/panels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: panelsList.map((p) => p.id) }),
    }).catch(() => {});
  }

  function onDragStart(e: DragEvent, id: string) { setDragId(id); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e: DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
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

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <NavBar title="پنل‌ها" />

      <div className="p-3 sm:p-6 max-w-4xl mx-auto">
        <PageTransition>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition mb-6">
          {showForm ? "انصراف" : "+ پنل جدید"}
        </button>

        {showForm && (
          <form onSubmit={savePanel} className="p-6 rounded-lg shadow mb-6 space-y-4" style={{ background: "var(--bg-secondary)" }}>
            <input placeholder="نام پنل" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded border outline-none" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} required />
            <input placeholder="نام کاربری" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded border outline-none" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
            <input placeholder="رمز عبور" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded border outline-none" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
            <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <p className="text-gray-400 text-sm mb-2">یا API Token</p>
              <input placeholder="API Token" value={apiToken} onChange={(e) => setApiToken(e.target.value)}
                className="w-full p-3 rounded border outline-none" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-gray-400">آدرس ادمین (URL پنل برای مدیریت) *</label>
              <input placeholder="https://host:port/path" value={url} onChange={(e) => setUrl(e.target.value)}
                className="w-full p-3 rounded border outline-none mt-1" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" required />
            </div>
            <div>
              <label className="text-xs text-gray-400">آدرس مشتری (برای لینک‌ها و سابسکریپشن)</label>
              <input placeholder="https://host:port/path" value={clientUrl} onChange={(e) => setClientUrl(e.target.value)}
                className="w-full p-3 rounded border outline-none mt-1" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Subscription Base URL (اختیاری، اولویت با آدرس مشتری)</label>
              <input placeholder="https://host:port/path" value={subUri} onChange={(e) => setSubUri(e.target.value)}
                className="w-full p-3 rounded border outline-none mt-1" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-gray-400">مالک پنل</label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                className="w-full p-3 rounded border outline-none mt-1" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                <option value="">بدون مالک</option>
                {admins.filter(a => a.role !== "superadmin").map(a => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={testConnection} disabled={testing}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded transition">
                {testing ? <><Spinner /> تست اتصال</> : "تست اتصال"}
              </button>
              <button type="submit" disabled={saving || !name || !url}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition">
                {saving ? <><Spinner /> ذخیره</> : editId ? "ویرایش" : "ذخیره"}
              </button>
            </div>
            {testResult && (
              <p className={`text-sm text-center ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
              </p>
            )}
          </form>
        )}

        <p className="text-xs text-gray-500 mb-2">برای مرتب‌سازی بکشید و رها کنید</p>
        <div className="space-y-3">
          {panels.map((panel) => (
            <div key={panel.id} className="p-4 sm:p-5 rounded-lg shadow flex flex-wrap items-center justify-between gap-3"
              style={{ background: "var(--bg-secondary)" }}
              draggable onDragStart={(e) => onDragStart(e, panel.id)} onDragOver={onDragOver} onDrop={(e) => onDrop(e, panel.id)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-gray-500 cursor-grab text-lg shrink-0">⠿</span>
                <div className="min-w-0">
                  <h2 className="font-medium truncate">{panel.name}</h2>
                  <p className="text-gray-500 text-xs truncate" dir="ltr" title="آدرس ادمین">{panel.url}</p>
                  {panel.clientUrl && (
                    <p className="text-gray-400 text-xs truncate" dir="ltr" title="آدرس مشتری">{panel.clientUrl}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-gray-500 text-xs whitespace-nowrap">{formatPersianDate(panel.createdAt)}</p>
                    {panel.ownerId && (
                      <span className="text-xs text-purple-400 whitespace-nowrap">
                        {admins.find(a => a.id === panel.ownerId)?.username || "نامشخص"}
                      </span>
                    )}
                    {panelDetails[panel.id] && (
                      <>
                        <span className="text-xs text-blue-400 whitespace-nowrap">{panelDetails[panel.id].clientCount} کاربر</span>
                        <span className="text-xs text-green-400 whitespace-nowrap">{panelDetails[panel.id].onlineCount} آنلاین</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => router.push(`/admin/panels/${panel.id}`)}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm transition">مدیریت</button>
                <button onClick={() => openEdit(panel)}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1.5 rounded text-sm transition">ویرایش</button>
                <button onClick={() => removePanel(panel.id)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm transition">حذف</button>
              </div>
            </div>
          ))}
          {panels.length === 0 && (
            <p className="text-center text-gray-500 py-12">هیچ پنلی اضافه نشده</p>
          )}
        </div>
        </PageTransition>
      </div>
    </div>
  );
}
