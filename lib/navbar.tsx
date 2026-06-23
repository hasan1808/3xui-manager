"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, type ReactNode, type RefObject } from "react";
import { useTheme } from "@/lib/theme-context";

interface NavBarProps {
  title: string;
  search?: ReactNode;
  backTo?: string;
}

function useOutsideClose(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onClose]);
}

export default function NavBar({ title, search, backTo }: NavBarProps) {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useOutsideClose(hamburgerRef, () => setHamburgerOpen(false));
  useOutsideClose(moreRef, () => setMoreOpen(false));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const moreItems = [
    { label: "لاگ عملیات", action: () => router.push("/logs") },
    { label: "پشتیبان‌گیری", action: () => router.push("/backup") },
    { label: "تنظیمات ادمین", action: () => router.push("/admin") },
  ];

  function NavLinks({ horizontal }: { horizontal?: boolean }) {
    const cls = horizontal
      ? "flex items-center gap-1"
      : "flex flex-col";
    return (
      <div className={cls}>
        <button onClick={() => router.push("/dashboard")} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap">داشبورد</button>
        <button onClick={() => router.push("/panels")} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap">پنل‌ها</button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(!moreOpen)} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap w-full">
            بیشتر ▾
          </button>
          {moreOpen && (
            <div className={horizontal ? "absolute left-0 top-full mt-1 rounded-lg shadow-lg py-1 z-50 min-w-40" : "pr-4 space-y-1"}
              style={horizontal ? { background: "var(--bg-secondary)", border: "1px solid var(--border-color)" } : {}}>
              {moreItems.map((item) => (
                <button key={item.label} onClick={() => { setMoreOpen(false); setHamburgerOpen(false); item.action(); }}
                  className="block w-full text-right px-4 py-2 text-sm hover:opacity-80 transition whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <nav className="p-3 flex items-center justify-between shadow" style={{ background: "var(--bg-secondary)" }}>
      <div className="flex items-center gap-2">
        {backTo && <button onClick={() => router.push(backTo)} className="text-gray-400 hover:text-white transition p-1.5 rounded hover:bg-gray-700 text-lg" title="بازگشت">←</button>}
        <h1 className="text-base md:text-xl font-bold truncate max-w-[160px] md:max-w-none">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        {search && <div className="hidden md:block">{search}</div>}
        <button onClick={toggleTheme} className="text-gray-400 hover:text-white transition p-1.5 rounded hover:bg-gray-700 text-sm" title="تغییر تم">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <NavLinks horizontal />
          <button onClick={logout} className="text-red-400 hover:text-red-300 transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm whitespace-nowrap">خروج</button>
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden relative" ref={hamburgerRef}>
          <button onClick={() => setHamburgerOpen(!hamburgerOpen)} className="text-gray-400 hover:text-white transition p-1.5 rounded hover:bg-gray-700 text-lg">
            ☰
          </button>
          {hamburgerOpen && (
            <div className="absolute left-0 top-full mt-1 rounded-lg shadow-lg py-2 z-50 min-w-44 space-y-1 px-3"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              {search && <div className="md:hidden pb-2">{search}</div>}
              <NavLinks />
              <hr style={{ borderColor: "var(--border-color)" }} className="my-1" />
              <button onClick={logout} className="w-full text-right text-red-400 hover:text-red-300 transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm">خروج</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export function NavBarWithExport({ title, search, onExport, onImport }: NavBarProps & { onExport?: () => void; onImport?: () => void }) {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useOutsideClose(hamburgerRef, () => setHamburgerOpen(false));
  useOutsideClose(moreRef, () => setMoreOpen(false));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function NavLinks({ horizontal }: { horizontal?: boolean }) {
    const cls = horizontal ? "flex items-center gap-1" : "flex flex-col";
    return (
      <div className={cls}>
        <button onClick={() => router.push("/dashboard")} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap">داشبورد</button>
        <button onClick={() => router.push("/panels")} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap">پنل‌ها</button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(!moreOpen)} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap w-full">
            بیشتر ▾
          </button>
          {moreOpen && (
            <div className={horizontal ? "absolute left-0 top-full mt-1 rounded-lg shadow-lg py-1 z-50 min-w-44" : "pr-4 space-y-1"}
              style={horizontal ? { background: "var(--bg-secondary)", border: "1px solid var(--border-color)" } : {}}>
              <button onClick={() => { setMoreOpen(false); setHamburgerOpen(false); router.push("/logs"); }} className="block w-full text-right px-4 py-2 text-sm hover:opacity-80 transition whitespace-nowrap" style={{ color: "var(--text-primary)" }}>لاگ عملیات</button>
              <button onClick={() => { setMoreOpen(false); setHamburgerOpen(false); router.push("/backup"); }} className="block w-full text-right px-4 py-2 text-sm hover:opacity-80 transition whitespace-nowrap" style={{ color: "var(--text-primary)" }}>پشتیبان‌گیری</button>
              <button onClick={() => { setMoreOpen(false); setHamburgerOpen(false); router.push("/admin"); }} className="block w-full text-right px-4 py-2 text-sm hover:opacity-80 transition whitespace-nowrap" style={{ color: "var(--text-primary)" }}>تنظیمات ادمین</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <nav className="p-3 flex items-center justify-between shadow" style={{ background: "var(--bg-secondary)" }}>
      <h1 className="text-base md:text-xl font-bold truncate max-w-[160px] md:max-w-none">{title}</h1>
      <div className="flex items-center gap-1">
        <button onClick={toggleTheme} className="text-gray-400 hover:text-white transition p-1.5 rounded hover:bg-gray-700 text-sm" title="تغییر تم">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div className="hidden md:flex items-center gap-1">
          <NavLinks horizontal />
          <button onClick={logout} className="text-red-400 hover:text-red-300 transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm whitespace-nowrap">خروج</button>
        </div>

        <div className="md:hidden relative" ref={hamburgerRef}>
          <button onClick={() => setHamburgerOpen(!hamburgerOpen)} className="text-gray-400 hover:text-white transition p-1.5 rounded hover:bg-gray-700 text-lg">
            ☰
          </button>
          {hamburgerOpen && (
            <div className="absolute left-0 top-full mt-1 rounded-lg shadow-lg py-2 z-50 min-w-44 space-y-1 px-3"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <NavLinks />
              <hr style={{ borderColor: "var(--border-color)" }} className="my-1" />
              <button onClick={logout} className="w-full text-right text-red-400 hover:text-red-300 transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm">خروج</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
