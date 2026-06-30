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
  const [balance, setBalance] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useOutsideClose(hamburgerRef, () => setHamburgerOpen(false));
  useOutsideClose(moreRef, () => setMoreOpen(false));

  useEffect(() => {
    fetch("/api/admins/me").then((r) => { if (r.ok) return r.json(); throw new Error(); }).then((d) => { setUserRole(d.role); setBalance(d.role !== "superadmin" ? d.balance : null); }).catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isSuperadmin = userRole === "superadmin";

  const moreItems = [
    { label: "بخش مالی", action: () => router.push("/admin/finance") },
    ...(isSuperadmin ? [
      { label: "پنل‌ها", action: () => router.push("/admin/panels") },
      { label: "مدیریت مشتری‌ها", action: () => router.push("/admin/admins") },
      { label: "تنظیمات", action: () => router.push("/admin/settings") },
    ] : []),
  ];

  function NavLinks({ horizontal }: { horizontal?: boolean }) {
    const cls = horizontal
      ? "flex items-center gap-1"
      : "flex flex-col";
    return (
      <div className={cls}>
        <button onClick={() => router.push(isSuperadmin ? "/admin/dashboard" : "/user")} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap">داشبورد</button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(!moreOpen)} className="text-gray-300 hover:text-white transition px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-right whitespace-nowrap w-full">
            بیشتر ▾
          </button>
          {moreOpen && (
            <div className={horizontal ? "absolute left-0 top-full mt-1 rounded-lg shadow-lg py-1 z-50 min-w-44" : "pr-4 space-y-1"}
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
              {balance !== null && (
          <button onClick={() => router.push(isSuperadmin ? "/admin/admins?tab=wallet" : "/user/wallet")}
            className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900/40 text-green-400 ml-1 hover:bg-green-800/50 transition cursor-pointer">
            <span>💰</span>
            <span dir="ltr">{balance.toLocaleString("en-US")}</span>
          </button>
        )}
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
            <div className="absolute left-0 top-full mt-1 rounded-lg shadow-lg py-2 z-50 min-w-44 px-3"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              {balance !== null && (
                <button onClick={() => { setHamburgerOpen(false); router.push(isSuperadmin ? "/admin/admins?tab=wallet" : "/user/wallet"); }}
                  className="w-full flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-green-900/40 text-green-400 transition cursor-pointer hover:bg-green-800/50">
                  <span>💰</span>
                  <span dir="ltr">{balance.toLocaleString("en-US")}</span>
                </button>
              )}
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
