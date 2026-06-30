import { Spinner } from "@/lib/spinner";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <Spinner />
    </div>
  );
}
