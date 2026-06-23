import { Spinner } from "@/lib/spinner";

export default function PanelsLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="text-center py-12"><Spinner /></div>
      </div>
    </div>
  );
}
