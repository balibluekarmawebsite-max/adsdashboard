"use client";

import { motion, type Variants } from "motion/react";
import { useSummary, useTimeseries } from "@/lib/metrics/client";
import { KpiCard } from "./kpi-card";
import { KpiCardSkeleton } from "./skeletons";
import { sentiment } from "@/lib/metrics/favorable";
import { formatNumber, formatMoney, formatRatioPct, formatRoas } from "@/lib/format";

type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "conversions" | "roas";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function KpiRow() {
  const { data: summary, isLoading, error } = useSummary();
  const { data: ts } = useTimeseries();

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
        Couldn’t load metrics: {error.message}
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const c = summary.current;
  const chg = summary.changePct;
  const currency = summary.currency;
  const series = ts?.series ?? [];
  const spark = (key: MetricKey) => series.map((s) => Number(s[key] ?? 0));

  // Full numbers with thousands separators (no M/K) so the exact figure reads
  // straight off the tile.
  const moneyExact = (n: number) => formatMoney(n, currency);

  const kpis: {
    key: string;
    label: string;
    value: number | null;
    format: (n: number) => string;
    delta: number | null;
    spark: number[];
  }[] = [
    { key: "spend", label: "Spend", value: c.spend, format: moneyExact, delta: chg.spend, spark: spark("spend") },
    { key: "impressions", label: "Impressions", value: c.impressions, format: formatNumber, delta: chg.impressions, spark: spark("impressions") },
    { key: "clicks", label: "Clicks", value: c.clicks, format: formatNumber, delta: chg.clicks, spark: spark("clicks") },
    { key: "ctr", label: "CTR", value: c.ctr, format: (n) => formatRatioPct(n), delta: chg.ctr, spark: spark("ctr") },
    { key: "cpc", label: "CPC", value: c.cpc, format: moneyExact, delta: chg.cpc, spark: spark("cpc") },
  ];

  // Revenue is blended (all platforms) — summary.revenue is null when a single
  // platform is selected, so the tile only appears where ROAS is meaningful.
  if (summary.revenue) {
    kpis.push({
      key: "revenue",
      label: "Revenue",
      value: summary.revenue.now,
      format: moneyExact,
      delta: summary.revenue.changePct,
      spark: [],
    });
  }
  kpis.push({ key: "roas", label: "ROAS", value: c.roas, format: (n) => formatRoas(n), delta: chg.roas, spark: spark("roas") });

  const fmtDate = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const prevLabel = `${fmtDate(summary.previousRange.from)} – ${fmtDate(summary.previousRange.to)}`;
  const deltaTitle = `vs. the previous period (${prevLabel})`;

  return (
    <div className="space-y-2.5">
      <p className="text-muted-foreground text-xs">
        <span className="font-medium">% change</span> vs. the previous period ·{" "}
        <span className="tabular-nums">{prevLabel}</span>
      </p>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {kpis.map((k) => (
          <motion.div key={k.key} variants={item}>
            <KpiCard
              label={k.label}
              value={k.value}
              format={k.format}
              delta={k.delta}
              deltaTitle={deltaTitle}
              sentiment={sentiment(k.key, k.delta)}
              spark={k.spark}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
