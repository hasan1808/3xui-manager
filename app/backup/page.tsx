"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/lib/spinner";

export default function BackupPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/backup"); }, [router]);
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner /></div>;
}
