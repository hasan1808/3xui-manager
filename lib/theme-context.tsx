"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { loadSettings, updateCachedSettings } from "@/lib/use-settings";

type Theme = "dark" | "light";

const DARK_VARS: Record<string, string> = {
  "--bg-primary": "#111827",
  "--bg-secondary": "#1f2937",
  "--bg-tertiary": "#374151",
  "--text-primary": "#ffffff",
  "--text-secondary": "#cbd5e1",
  "--border-color": "#374151",
};

const LIGHT_VARS: Record<string, string> = {
  "--bg-primary": "#f3f4f6",
  "--bg-secondary": "#ffffff",
  "--bg-tertiary": "#e5e7eb",
  "--text-primary": "#111827",
  "--text-secondary": "#6b7280",
  "--border-color": "#d1d5db",
};

function applyTheme(theme: Theme) {
  const vars = theme === "dark" ? DARK_VARS : LIGHT_VARS;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  root.style.setProperty("color-scheme", theme);
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const local = localStorage.getItem("theme");
    if (local === "light" || local === "dark") {
      setTheme(local);
      applyTheme(local);
      return;
    }
    loadSettings().then((s) => {
      if (s.theme === "system") {
        const sys = getSystemTheme();
        setTheme(sys);
        applyTheme(sys);
      } else if (s.theme === "light" || s.theme === "dark") {
        setTheme(s.theme);
        applyTheme(s.theme);
      }
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    updateCachedSettings({ theme });
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      loadSettings().then((s) => {
        if (s.theme === "system") {
          const sys = getSystemTheme();
          setTheme(sys);
          applyTheme(sys);
        }
      });
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
