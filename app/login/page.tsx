"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { Spinner } from "@/lib/spinner";
import PageTransition from "@/lib/page-transition";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "نام کاربری یا رمز عبور اشتباه است");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition>
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="absolute top-4 left-4 flex gap-2">
        <button onClick={toggleTheme} className="text-gray-400 hover:text-white transition p-2 rounded hover:bg-gray-700" title="تغییر تم">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-8 rounded-lg shadow-lg w-96 transition-shadow duration-200 hover:shadow-xl" style={{ background: "var(--bg-secondary)" }}>
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>3X-UI Manager</h1>
        <p className="text-gray-400 text-center mb-6 text-sm">مدیریت متمرکز چند پنل</p>
        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 text-sm mb-4 px-4 py-2.5 rounded">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}
        <input
          className="w-full p-3 mb-4 rounded border outline-none transition-shadow duration-200 focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
          placeholder="نام کاربری"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          className="w-full p-3 mb-6 rounded border outline-none transition-shadow duration-200 focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
          type="password"
          placeholder="رمز عبور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium transition flex items-center justify-center gap-2"
        >
          {loading ? <Spinner /> : null}
          {loading ? "در حال ورود..." : "ورود"}
        </button>
      </form>
    </div>
    </PageTransition>
  );
}
