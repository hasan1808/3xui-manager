"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/lib/spinner";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/admins/me")
      .then((r) => { if (r.ok) return r.json(); throw new Error(); })
      .then((d) => { setRole(d.role); router.replace(d.role === "superadmin" ? "/admin/dashboard" : "/user"); })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="text-center space-y-4">
        <Spinner />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>در حال بارگذاری...</p>
      </div>
    </div>
  );
}
