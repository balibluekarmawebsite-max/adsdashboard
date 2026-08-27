import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import type { PlatformName } from "@/lib/sync/types";
import { revenueForRange } from "@/lib/revenue/roas";
import { includedCampaignFilter } from "@/lib/campaigns/query";
import { summarize, pctChange, type Totals, type Summary } from "./derive";

// Prisma sums come back as number | Decimal | null — coerce to a plain number.
const num = (x: unknown): number => (x == null ? 0 : Number(x));

const SUM = {
  impressions: true,
  clicks: true,
  spend: true,
  conversions: true,
  conversionValue: true,
} as const;

type SumShape = {
  impressions: number | null;
  clicks: number | null;
  spend: unknown;
  conversions: unknown;
  conversionValue: unknown;
};

function totalsFromSum(s: SumShape | null | undefined): Totals {
  return {
    impressions: num(s?.impressions),
    clicks: num(s?.clicks),
    spend: num(s?.spend),
    conversions: num(s?.conversions),
    conversionValue: num(s?.conversionValue),
  };
}

// ---------------------------------------------------------------------------
// Filter parsing / validation
// ---------------------------------------------------------------------------

export interface MetricsFilter {
  from: Date;
  to: Date;
  fromStr: string;
  toStr: string;
  days: number;
  propertyId?: string;
  platform?: PlatformName;
  /** External ids of campaigns shown on the report; undefined = no filter. */
  includedCampaignIds?: string[];
}

function parseDate(value: string | null, field: string): { date: Date; str: string } {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `Invalid or missing "${field}" (expected YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `Invalid "${field}" date`);
  return { date, str: value };
}

export async function parseMetricsParams(sp: URLSearchParams): Promise<MetricsFilter> {
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (from.date > to.date) throw new ApiError(400, `"from" must be on or before "to"`);

  let platform: PlatformName | undefined;
  const platformParam = sp.get("platform");
  if (platformParam && platformParam !== "all") {
    if (platformParam !== "google" && platformParam !== "meta") {
      throw new ApiError(400, `Invalid "platform" (expected google, meta, or all)`);
    }
    platform = platformParam;
  }

  let propertyId: string | undefined;
  const propertyParam = sp.get("property");
  if (propertyParam && propertyParam !== "all") {
    const property = await prisma.property.findFirst({
      where: { OR: [{ code: propertyParam }, { id: propertyParam }] },
      select: { id: true },
    });
    if (!property) throw new ApiError(400, `Unknown property "${propertyParam}"`);
    propertyId = property.id;
  }

  const days = Math.round((to.date.getTime() - from.date.getTime()) / 86_400_000) + 1;
  // Restrict the report to campaigns marked "included" (null = registry empty).
  const includedCampaignIds = (await includedCampaignFilter()) ?? undefined;
  return {
    from: from.date,
    to: to.date,
    fromStr: from.str,
    toStr: to.str,
    days,
    propertyId,
    platform,
    includedCampaignIds,
  };
}

type Where = {
  date: { gte: Date; lte: Date };
  propertyId?: string;
  platform?: PlatformName;
  campaignId?: { in: string[] };
};

function whereFor(filter: MetricsFilter, from = filter.from, to = filter.to): Where {
  return {
    date: { gte: from, lte: to },
    ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
    ...(filter.platform ? { platform: filter.platform } : {}),
    ...(filter.includedCampaignIds ? { campaignId: { in: filter.includedCampaignIds } } : {}),
  };
}

function rangeMeta(filter: MetricsFilter) {
  return { from: filter.fromStr, to: filter.toStr, days: filter.days };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Aggregations (all done in SQL via Prisma)
// ---------------------------------------------------------------------------

async function getTotals(where: Where): Promise<Totals> {
  const agg = await prisma.metricsDaily.aggregate({ where, _sum: SUM });
  return totalsFromSum(agg._sum);
}

/**
 * A cheap fingerprint of the rows behind a filter — row count, total spend, and
 * the latest row-update time. Folded into the AI-summary cache key so a cached
 * summary is reused only while the underlying data is unchanged (a re-sync that
 * touches these rows changes the signature and forces a fresh summary).
 */
export async function dataSignature(filter: MetricsFilter): Promise<string> {
  const agg = await prisma.metricsDaily.aggregate({
    where: whereFor(filter),
    _count: { _all: true },
    _sum: { spend: true },
    _max: { updatedAt: true },
  });
  const spend = Math.round(Number(agg._sum.spend ?? 0));
  return `${agg._count._all}:${spend}:${agg._max.updatedAt?.toISOString() ?? "none"}`;
}

/**
 * Currency safety: if the filtered rows span more than one currency, summing
 * spend across them is meaningless — flag it instead of silently summing.
 */
async function getCurrencyInfo(where: Where) {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["currency"],
    where,
    _count: { _all: true },
  });
  const currencies = groups.map((g) => g.currency.trim());
  return {
    currency: currencies.length === 1 ? currencies[0] : null,
    mixedCurrency: currencies.length > 1,
    currencies,
  };
}

export async function summary(filter: MetricsFilter) {
  const where = whereFor(filter);

  // Previous equal-length period, immediately preceding the selected range.
  const prevTo = new Date(filter.from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (filter.days - 1));

  // Revenue is a per-property monthly total (not per platform), so revenue-based
  // ROAS is only meaningful blended — compute it when no single platform is set.
  const blended = !filter.platform;

  const [curTotals, prevTotals, currency, curRevenue, prevRevenue] = await Promise.all([
    getTotals(where),
    getTotals(whereFor(filter, prevFrom, prevTo)),
    getCurrencyInfo(where),
    blended ? revenueForRange(filter.from, filter.to, filter.propertyId) : Promise.resolve(0),
    blended ? revenueForRange(prevFrom, prevTo, filter.propertyId) : Promise.resolve(0),
  ]);

  const current = summarize(curTotals);
  const previous = summarize(prevTotals);

  // Prefer revenue ÷ spend for ROAS whenever revenue exists for the range.
  if (blended && curRevenue > 0) current.roas = current.spend > 0 ? curRevenue / current.spend : null;
  if (blended && prevRevenue > 0)
    previous.roas = previous.spend > 0 ? prevRevenue / previous.spend : null;

  const changePct = {} as Record<keyof Summary, number | null>;
  (Object.keys(current) as (keyof Summary)[]).forEach((k) => {
    changePct[k] = pctChange(current[k], previous[k]);
  });

  return {
    range: rangeMeta(filter),
    previousRange: { from: iso(prevFrom), to: iso(prevTo) },
    filters: { property: filter.propertyId ?? "all", platform: filter.platform ?? "all" },
    ...currency,
    revenue: blended
      ? { now: curRevenue, prev: prevRevenue, changePct: pctChange(curRevenue, prevRevenue) }
      : null,
    current,
    previous,
    changePct,
  };
}

export async function timeseries(filter: MetricsFilter) {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["date"],
    where: whereFor(filter),
    _sum: SUM,
    orderBy: { date: "asc" },
  });
  const series = groups.map((g) => ({ date: iso(g.date), ...summarize(totalsFromSum(g._sum)) }));
  return { range: rangeMeta(filter), series };
}

export async function byPlatform(filter: MetricsFilter) {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["platform"],
    where: whereFor(filter),
    _sum: SUM,
  });
  const platforms = groups.map((g) => ({
    platform: g.platform,
    ...summarize(totalsFromSum(g._sum)),
  }));
  return { range: rangeMeta(filter), platforms };
}

export async function byProperty(filter: MetricsFilter) {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["propertyId"],
    where: whereFor(filter),
    _sum: SUM,
  });
  const props = await prisma.property.findMany({
    where: { id: { in: groups.map((g) => g.propertyId) }, active: true },
    select: { id: true, code: true, name: true },
  });
  const byId = new Map(props.map((p) => [p.id, p]));
  const blended = !filter.platform;
  const properties = (
    await Promise.all(
      groups
        .filter((g) => byId.has(g.propertyId)) // drop hidden/inactive properties
        .map(async (g) => {
          const s = summarize(totalsFromSum(g._sum));
          let revenue: number | null = null;
          if (blended) {
            revenue = await revenueForRange(filter.from, filter.to, g.propertyId);
            if (revenue > 0) s.roas = s.spend > 0 ? revenue / s.spend : null;
          }
          return {
            propertyId: g.propertyId,
            code: byId.get(g.propertyId)?.code ?? null,
            name: byId.get(g.propertyId)?.name ?? null,
            revenue,
            ...s,
          };
        }),
    )
  ).sort((a, b) => b.spend - a.spend);
  return { range: rangeMeta(filter), properties };
}

export async function byCampaign(filter: MetricsFilter, limit = 500) {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["campaignId", "campaignName", "platform"],
    where: whereFor(filter),
    _sum: SUM,
    orderBy: { _sum: { spend: "desc" } },
    take: limit,
  });
  const campaigns = groups.map((g) => ({
    campaignId: g.campaignId,
    campaignName: g.campaignName,
    platform: g.platform,
    ...summarize(totalsFromSum(g._sum)),
  }));
  return { range: rangeMeta(filter), campaigns };
}

// Response types — reused client-side via `import type` (erased at build, so no
// server code is bundled). Keeps the API and the UI in lock-step.
export type SummaryResult = Awaited<ReturnType<typeof summary>>;
export type TimeseriesResult = Awaited<ReturnType<typeof timeseries>>;
export type ByPlatformResult = Awaited<ReturnType<typeof byPlatform>>;
export type ByPropertyResult = Awaited<ReturnType<typeof byProperty>>;
export type ByCampaignResult = Awaited<ReturnType<typeof byCampaign>>;
