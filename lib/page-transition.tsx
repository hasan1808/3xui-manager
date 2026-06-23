"use client";
import { type ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="transition-all duration-300 opacity-100 translate-y-0">
      {children}
    </div>
  );
}
