// Phase 9 — the "snapshot" the AI narrates.
//
// CORE PRINCIPLE: we compute every number here; the model only phrases them.
// This turns the Phase 5 aggregates into a small, pre-computed JSON payload
// (a few hundred tokens) — never raw daily rows. Nulls are preserved honestly
// (e.g. ROAS when no conversion/revenue data exists) so the model can say
// "not available" instead of inventing a figure.

import {
  type MetricsFilter,
  summary,
  byPlatform,
  byProperty,
  byCampaign,
  dataSignature,
} from "@/lib/metrics/query";

const int = (x: number | null | undefined): number | null =>
  x == null ? null : Math.round(Number(x));
const dec = (x: number | null | undefined): number | null =>
  x == null ? null : Number(Number(x).toFixed(2));

export interface Kpi {
  now: number | null;
  prev: number | null;
  changePct: number | null;
}

export interface InsightSnapshot {
  period: { from: string; to: string; days: number };
  comparisonPeriod: { from: string; to: string };
  filters: { property: string; platform: string };
  units: { money: string; ctr: string; roas: string };
  currency: string | null;
  mixedCurrency: boolean;
  kpis: {
    spend: Kpi;
    impressions: Kpi;
    clicks: Kpi;
    ctr: Kpi;
    cpc: Kpi;
    conversions: Kpi;
    roas: Kpi;
  };
  /** Blended monthly revenue allocated to this range (null when a single
   *  platform is selected, since revenue isn't per-platform). ROAS above uses it. */
  revenue: Kpi | null;
  byPlatform: Array<{
    platform: string;
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    conversions: number | null;
    roas: number | null;
  }>;
  byProperty: Array<{
    code: string | null;
    name: string | null;
    spend: number | null;
    conversions: number | null;
    roas: number | null;
  }>;
  topCampaigns: Array<{ name: string; platform: string; spend: number | null; roas: number | null }>;
  biggestMovers: Array<{
    name: string;
    platform: string;
    spendNow: number | null;
    spendPrev: number | null;
    spendChangePct: number | null;
    direction: "up" | "down" | "new";
  }>;
}

export interface SnapshotResult {
  snapshot: InsightSnapshot;
  /** rows:spend:maxUpdatedAt — folded into the cache key (see AiSummary). */
  dataSignature: string;
  /** Convenience flag so callers can skip the model entirely on an empty view. */
  isEmpty: boolean;
}

/** The immediately-preceding equal-length period (mirrors summary()'s logic). */
function precedingPeriod(filter: MetricsFilter): MetricsFilter {
  const to = new Date(filter.from);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (filter.days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { ...filter, from, to, fromStr: iso(from), toStr: iso(to) };
}

export async function buildSnapshot(filter: MetricsFilter): Promise<SnapshotResult> {
  const prev = precedingPeriod(filter);

  const [sum, platforms, properties, campaignsNow, campaignsPrev, sig] = await Promise.all([
    summary(filter),
    byPlatform(filter),
    byProperty(filter),
    byCampaign(filter, 500),
    byCampaign(prev, 500),
    dataSignature(filter),
  ]);

  const kpi = (key: "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "conversions" | "roas") => {
    // CTR is a ratio in the aggregates; present it as a percentage for the model.
    const scale = key === "ctr" ? 100 : 1;
    const shape = key === "spend" || key === "impressions" || key === "clicks" ? int : dec;
    return {
      now: shape(sum.current[key] == null ? null : (sum.current[key] as number) * scale),
      prev: shape(sum.previous[key] == null ? null : (sum.previous[key] as number) * scale),
      changePct: dec(sum.changePct[key]),
    };
  };

  // Biggest movers by absolute spend change vs the previous period.
  const prevSpend = new Map(campaignsPrev.campaigns.map((c) => [c.campaignId, Number(c.spend)]));
  const movers = campaignsNow.campaigns
    .map((c) => {
      const now = Number(c.spend);
      const before = prevSpend.get(c.campaignId) ?? 0;
      const changePct = before > 0 ? ((now - before) / before) * 100 : null;
      const direction: "up" | "down" | "new" = before === 0 ? "new" : now >= before ? "up" : "down";
      return { name: c.campaignName, platform: c.platform, now, before, changePct, direction };
    })
    .filter((m) => m.now > 0)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      platform: m.platform,
      spendNow: int(m.now),
      spendPrev: int(m.before),
      spendChangePct: dec(m.changePct),
      direction: m.direction,
    }));

  const snapshot: InsightSnapshot = {
    period: sum.range,
    comparisonPeriod: sum.previousRange,
    filters: sum.filters,
    units: { money: sum.currency ?? "mixed", ctr: "percent", roas: "ratio (revenue / spend)" },
    currency: sum.currency,
    mixedCurrency: sum.mixedCurrency,
    kpis: {
      spend: kpi("spend"),
      impressions: kpi("impressions"),
      clicks: kpi("clicks"),
      ctr: kpi("ctr"),
      cpc: kpi("cpc"),
      conversions: kpi("conversions"),
      roas: kpi("roas"),
    },
    revenue: sum.revenue
      ? { now: int(sum.revenue.now), prev: int(sum.revenue.prev), changePct: dec(sum.revenue.changePct) }
      : null,
    byPlatform: platforms.platforms.map((p) => ({
      platform: p.platform,
      spend: int(p.spend),
      impressions: int(p.impressions),
      clicks: int(p.clicks),
      conversions: dec(p.conversions),
      roas: dec(p.roas),
    })),
    byProperty: properties.properties.map((p) => ({
      code: p.code,
      name: p.name,
      spend: int(p.spend),
      conversions: dec(p.conversions),
      roas: dec(p.roas),
    })),
    topCampaigns: campaignsNow.campaigns.slice(0, 5).map((c) => ({
      name: c.campaignName,
      platform: c.platform,
      spend: int(c.spend),
      roas: dec(c.roas),
    })),
    biggestMovers: movers,
  };

  return { snapshot, dataSignature: sig, isEmpty: (int(sum.current.spend) ?? 0) === 0 };
}
