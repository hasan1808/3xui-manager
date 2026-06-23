"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx>({
  confirm: () => Promise.resolve(false),
});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<((val: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback(async (o: ConfirmOptions) => {
    lastFocus.current = document.activeElement as HTMLElement;
    return new Promise<boolean>((res) => {
      setOpts(o);
      setResolve(() => res);
    });
  }, []);

  function handleAnswer(val: boolean) {
    resolve?.(val);
    setOpts(null);
    setResolve(null);
    setTimeout(() => lastFocus.current?.focus(), 0);
  }

  useEffect(() => {
    if (!opts || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { handleAnswer(false); return; }
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [opts]);

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {opts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => handleAnswer(false)}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title"
            className="rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl"
            style={{ background: "var(--bg-secondary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-lg font-semibold mb-2">{opts.title}</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{opts.message}</p>
            <div className="flex gap-3">
              <button onClick={() => handleAnswer(false)} className="flex-1 py-2.5 rounded text-sm transition" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                {opts.cancelLabel || "انصراف"}
              </button>
              <button onClick={() => handleAnswer(true)} className={`flex-1 py-2.5 rounded text-sm text-white transition ${opts.variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                {opts.confirmLabel || "تأیید"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
