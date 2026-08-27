"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSummary, useTimeseries } from "@/lib/metrics/client";
import { ChartCard } from "./chart-card";
import { formatCompact, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type MetricKey = "spend" | "impressions" | "clicks" | "conversions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

const OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "conversions", label: "Conversions" },
];

export function TrendChart() {
  const [metric, setMetric] = useState<MetricKey>("spend");
  const { data, isLoading, error } = useTimeseries();
  const { data: summary } = useSummary();
  const currency = summary?.currency ?? null;

  const fmtValue = (n: number) =>
    metric === "spend" ? formatMoney(n, currency) : formatNumber(n);

  const series = (data?.series ?? []).map((s) => ({ date: s.date, value: Number(s[metric] ?? 0) }));

  const toggle = (
    <div className="bg-muted flex items-center rounded-md p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => setMetric(o.key)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            metric === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard title="Performance over time" actions={toggle}>
      <div className="h-[300px] w-full">
        {error ? (
          <EmptyState message={`Couldn’t load the trend: ${error.message}`} tone="error" />
        ) : isLoading && series.length === 0 ? (
          <div className="bg-muted h-full w-full animate-pulse rounded-md" />
        ) : series.length === 0 ? (
          <EmptyState message="No data in this range." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                width={44}
                tickFormatter={(v) => formatCompact(Number(v))}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="border-border bg-popover rounded-md border px-3 py-2 text-xs shadow-md">
                      <p className="text-muted-foreground">{shortDate(String(label))}</p>
                      <p className="text-foreground font-medium tabular-nums">
                        {fmtValue(Number(payload[0].value))}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#trendFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

function EmptyState({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center rounded-md text-center text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {message}
    </div>
  );
}
