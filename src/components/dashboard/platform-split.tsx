"use client";

import { useByPlatform, useSummary } from "@/lib/metrics/client";
import { ChartCard } from "./chart-card";
import { formatNumber, formatMoney, formatRoas } from "@/lib/format";

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  google: { label: "Google", color: "var(--platform-google)" },
  meta: { label: "Meta", color: "var(--platform-meta)" },
};

export function PlatformSplit() {
  const { data, isLoading, error } = useByPlatform();
  const { data: summary } = useSummary();
  const currency = summary?.currency ?? null;

  const found = data?.platforms ?? [];
  const rows = ["google", "meta"]
    .map((p) => found.find((x) => x.platform === p))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));

  return (
    <ChartCard title="Google vs Meta">
      {error ? (
        <p className="text-destructive text-sm">Couldn’t load this breakdown.</p>
      ) : isLoading && rows.length === 0 ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-muted h-14 animate-pulse rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No data in this range.</p>
      ) : (
        <div className="space-y-5">
          {rows.map((r) => {
            const meta = PLATFORM_META[r.platform];
            const share = totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0;
            return (
              <div key={r.platform} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: meta.color }}
                      aria-hidden
                    />
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatMoney(r.spend, currency)} · {share.toFixed(0)}%
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(r.spend / maxSpend) * 100}%`, background: meta.color }}
                  />
                </div>
                <div className="text-muted-foreground flex gap-4 text-xs tabular-nums">
                  <span>{formatNumber(r.conversions)} conv.</span>
                  <span>ROAS {formatRoas(r.roas)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
