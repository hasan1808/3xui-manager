import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/lib/toast-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ConfirmProvider } from "@/lib/confirm-dialog";

export const metadata: Metadata = {
  title: "3X-UI Manager",
  description: "Centralized multi-panel management",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
