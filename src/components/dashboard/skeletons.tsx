export function KpiCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <div className="bg-muted h-3 w-16 animate-pulse rounded" />
      <div className="bg-muted mt-3 h-7 w-24 animate-pulse rounded" />
      <div className="bg-muted mt-3 h-8 w-full animate-pulse rounded" />
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
      <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      <div className="bg-muted mt-4 w-full animate-pulse rounded" style={{ height }} />
    </div>
  );
}
