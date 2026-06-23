import { Spinner } from "@/lib/spinner";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="p-3 sm:p-6 max-w-6xl mx-auto">
        <div className="text-center py-12"><Spinner /></div>
      </div>
    </div>
  );
}
