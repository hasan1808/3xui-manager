"use client";
import { useEffect } from "react";

type ShortcutMap = Record<string, () => void>;

export function useKeyboardShortcuts(map: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") { map["Escape"]?.(); }
        return;
      }
      const key = [e.ctrlKey ? "Ctrl" : "", e.key].filter(Boolean).join("+");
      const fn = map[key] || map[e.key];
      if (fn) { e.preventDefault(); fn(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
