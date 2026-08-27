"use client";

import { useCountUp } from "@/lib/hooks/use-count-up";
import { Sparkline } from "./sparkline";
import { formatDelta } from "@/lib/format";
import type { Sentiment } from "@/lib/metrics/favorable";
import { cn } from "@/lib/utils";

const SENTIMENT_CLASS: Record<Sentiment, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  format,
  delta,
  deltaTitle,
  sentiment,
  spark,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  delta: number | null;
  deltaTitle?: string;
  sentiment: Sentiment;
  spark: number[];
}) {
  const animated = useCountUp(value ?? 0);

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {delta != null && (
          <span
            title={deltaTitle}
            className={cn(
              "text-xs font-medium tabular-nums",
              deltaTitle && "cursor-help",
              SENTIMENT_CLASS[sentiment],
            )}
          >
            {formatDelta(delta)}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums xl:text-2xl">
        {value == null ? "—" : format(animated)}
      </p>
      <div className={cn("mt-3 h-8", SENTIMENT_CLASS[sentiment])}>
        <Sparkline data={spark} />
      </div>
    </div>
  );
}
