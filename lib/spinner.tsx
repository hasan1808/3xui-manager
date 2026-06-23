export function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: "var(--bg-tertiary)" }} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg p-5 shadow space-y-3" style={{ background: "var(--bg-secondary)" }}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-16 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded p-3 text-center space-y-2" style={{ background: "var(--bg-tertiary)" }}>
            <Skeleton className="h-3 w-12 mx-auto" />
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
