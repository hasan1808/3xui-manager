"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/lib/spinner";

export default function LogsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/logs"); }, [router]);
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner /></div>;
}
