"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/lib/spinner";

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/admins/me").then((r) => { if (r.ok) return r.json(); throw new Error(); }).then((u) => { router.replace(u.role === "superadmin" ? "/admin/dashboard" : "/user"); }).catch(() => router.replace("/login"));
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner /></div>;
}
