"use client";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/lib/spinner";

export default function PanelDetailRedirect() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => { router.replace(`/admin/panels/${id}`); }, [router, id]);
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><Spinner /></div>;
}
