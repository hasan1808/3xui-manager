"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { loadSettings, getCachedSettings } from "@/lib/use-settings";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const ToastCtx = createContext<{ toast: (msg: string, type?: "success" | "error") => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const durationRef = useRef({ success: 3000, error: 8000 });

  useEffect(() => {
    loadSettings().then((s) => {
      const d = s.toastDuration * 1000;
      durationRef.current = { success: d, error: Math.max(d, 5000) };
    });
  }, []);

  const add = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    const duration = type === "error" ? durationRef.current.error : durationRef.current.success;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastCtx.Provider value={{ toast: add }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" dir="rtl">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-2 rounded shadow-lg text-sm text-white transition-all animate-slide-up ${t.type === "success" ? "bg-green-700" : "bg-red-700"}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.2s ease-out; }
      `}</style>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
