"use client";

import { motion, type Variants } from "motion/react";
import { useSummary, useTimeseries } from "@/lib/metrics/client";
import { KpiCard } from "./kpi-card";
import { KpiCardSkeleton } from "./skeletons";
import { sentiment } from "@/lib/metrics/favorable";
import { formatCompact, formatMoney, formatRatioPct, formatRoas } from "@/lib/format";

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

  const money = (n: number) => formatMoney(n, currency, { compact: true });
  const moneyExact = (n: number) => formatMoney(n, currency);

  const kpis: {
    key: MetricKey;
    label: string;
    value: number | null;
    format: (n: number) => string;
  }[] = [
    { key: "spend", label: "Spend", value: c.spend, format: money },
    { key: "impressions", label: "Impressions", value: c.impressions, format: formatCompact },
    { key: "clicks", label: "Clicks", value: c.clicks, format: formatCompact },
    { key: "ctr", label: "CTR", value: c.ctr, format: (n) => formatRatioPct(n) },
    { key: "cpc", label: "CPC", value: c.cpc, format: moneyExact },
    { key: "conversions", label: "Conversions", value: c.conversions, format: formatCompact },
    { key: "roas", label: "ROAS", value: c.roas, format: (n) => formatRoas(n) },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
    >
      {kpis.map((k) => (
        <motion.div key={k.key} variants={item}>
          <KpiCard
            label={k.label}
            value={k.value}
            format={k.format}
            delta={chg[k.key]}
            sentiment={sentiment(k.key, chg[k.key])}
            spark={spark(k.key)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
