"use client";

import { useByProperty, useSummary } from "@/lib/metrics/client";
import { ChartCard } from "./chart-card";
import { formatMoney } from "@/lib/format";

export function PropertyComparison() {
  const { data, isLoading, error } = useByProperty();
  const { data: summary } = useSummary();
  const currency = summary?.currency ?? null;

  const props = data?.properties ?? [];
  const maxSpend = Math.max(1, ...props.map((p) => p.spend));

  return (
    <ChartCard title="Properties by spend">
      {error ? (
        <p className="text-destructive text-sm">Couldn’t load this comparison.</p>
      ) : isLoading && props.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-9 animate-pulse rounded-md" />
          ))}
        </div>
      ) : props.length === 0 ? (
        <p className="text-muted-foreground text-sm">No data in this range.</p>
      ) : (
        <div className="space-y-3">
          {props.map((p) => (
            <div key={p.propertyId} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  {p.code ?? "—"}
                  <span className="text-muted-foreground ml-2 text-xs font-normal">{p.name}</span>
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatMoney(p.spend, currency, { compact: true })}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${(p.spend / maxSpend) * 100}%`, background: "var(--chart-1)" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
