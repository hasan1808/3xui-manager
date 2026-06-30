"use client";
import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

const PERSIAN_RE = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u200C-\u200F]/g;

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [persianWarning, setPersianWarning] = useState("");
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    fetch("/api/admins/me", { cache: "no-store" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); })
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"));
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          setError("تلاش زیاد. لطفاً چند دقیقه صبر کنید");
        } else {
          setError(data.error || "نام کاربری یا رمز عبور اشتباه است");
        }
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Spinner />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <button onClick={toggleTheme}
          className="fixed top-4 left-4 z-10 p-2 rounded-lg transition"
          style={{ color: "var(--text-secondary)" }}
          title="تغییر تم">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="rounded-2xl p-8 border shadow-2xl"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>

            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🛡️</div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>3X-UI Manager</h1>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>مدیریت متمرکز چند پنل</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4"
                style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#f87171" }}>
                <span>{error}</span>
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>نام کاربری</label>
              <div className="relative">
                <input value={username} onChange={(e) => {
                  const v = e.target.value;
                  setPersianWarning(PERSIAN_RE.test(v) ? "کاراکتر فارسی مجاز نیست" : "");
                  setUsername(v.replace(PERSIAN_RE, ""));
                }}
                  placeholder="نام کاربری" autoFocus autoComplete="username"
                  className="w-full p-3 pl-3 rounded-xl border outline-none text-sm transition focus:ring-2 focus:ring-blue-500/50"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
              </div>
            </div>

            <div className="mb-2">
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>رمز عبور</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"}
                  value={password} onChange={(e) => {
                    const v = e.target.value;
                    setPersianWarning(PERSIAN_RE.test(v) ? "کاراکتر فارسی مجاز نیست" : "");
                    setPassword(v.replace(PERSIAN_RE, ""));
                  }}
                  placeholder="رمز عبور" autoComplete="current-password"
                  onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  className="w-full p-3 pl-10 rounded-xl border outline-none text-sm transition focus:ring-2 focus:ring-blue-500/50"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm p-0.5 rounded transition"
                  style={{ color: "var(--text-secondary)" }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {capsLock && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg mb-2"
                style={{ background: "rgba(250,204,21,0.12)", color: "#eab308" }}>
                <span>Caps Lock فعال است</span>
              </div>
            )}
            {persianWarning && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg mb-2"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                <span>{persianWarning}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !username || !password}
              className="w-full py-3 mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:cursor-not-allowed">
              {loading ? <Spinner /> : null}
              {loading ? "در حال ورود..." : "ورود به سیستم"}
            </button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
