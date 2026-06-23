"use client";
import { useRef, useEffect, type ReactNode } from "react";

interface FocusTrapProps {
  children: ReactNode;
  active: boolean;
  onClose?: () => void;
}

export default function FocusTrap({ children, active, onClose }: FocusTrapProps) {
  const root = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const el = root.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last_el = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last_el?.focus(); }
      else if (!e.shiftKey && document.activeElement === last_el) { e.preventDefault(); first?.focus(); }
    }
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      setTimeout(() => lastFocus.current?.focus(), 0);
    };
  }, [active]);

  return <div ref={root}>{children}</div>;
}
