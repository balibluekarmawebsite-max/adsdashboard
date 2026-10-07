import { prisma } from "@/lib/db";
import { ApiError } from "./errors";
import {
  systemMetricsFilter,
  summary,
  byPlatform,
  byProperty,
  byCampaign,
  timeseries,
  type MetricsFilter,
} from "@/lib/metrics/query";
import type { PlatformName } from "@/lib/sync/types";
import { toReportingDateString } from "@/lib/sync/dates";

// Shapes and helpers for the public reporting API (/api/v1/*). Everything is
// read-only and reuses the exact aggregations the dashboard renders, so the two
// never disagree. The "all" scope is hotels-only for the blended KPIs (matching
// the dashboard); the per-property breakdown includes outlets and wellness.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

function parsePlatform(v: string | null): PlatformName | undefined {
  if (!v || v === "all") return undefined;
  if (v === "google" || v === "meta") return v;
  throw new ApiError(400, 'Invalid "platform" (expected "google", "meta", or "all").');
}

export const API_PERIODS = [
  "last-week",
  "this-week",
  "last-7",
  "last-30",
  "this-month",
  "last-month",
] as const;

/**
 * The reporting window: explicit `from`/`to` (YYYY-MM-DD) win; otherwise a named
 * `period` (default "last-week" = the previous complete Mon–Sun), computed in the
 * reporting timezone.
 */
export function resolveApiRange(sp: URLSearchParams): { from: string; to: string } {
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    if (!from || !to) throw new ApiError(400, "Provide both from and to (YYYY-MM-DD), or use period.");
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new ApiError(400, "from/to must be YYYY-MM-DD.");
    if (from > to) throw new ApiError(400, "from must be on or before to.");
    return { from, to };
  }

  const period = (sp.get("period") ?? "last-week").toLowerCase();
  const todayStr = toReportingDateString(new Date());
  const today = utc(todayStr);
  const minus = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - n);
    return iso(d);
  };
  const mondayOffset = (today.getUTCDay() + 6) % 7; // days since Monday (Mon=0)
  const [y, m] = todayStr.split("-").map(Number);

  switch (period) {
    case "last-7":
      return { from: minus(6), to: todayStr };
    case "last-30":
      return { from: minus(29), to: todayStr };
    case "this-week":
      return { from: minus(mondayOffset), to: todayStr };
    case "last-week": {
      const lastSun = new Date(today);
      lastSun.setUTCDate(lastSun.getUTCDate() - mondayOffset - 1);
      const lastMon = new Date(lastSun);
      lastMon.setUTCDate(lastMon.getUTCDate() - 6);
      return { from: iso(lastMon), to: iso(lastSun) };
    }
    case "this-month":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: todayStr };
    case "last-month": {
      const lastPrev = new Date(Date.UTC(y, m - 1, 1));
      lastPrev.setUTCDate(0);
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      return { from: iso(firstPrev), to: iso(lastPrev) };
    }
    default:
      throw new ApiError(400, `Invalid "period" (one of: ${API_PERIODS.join(", ")}).`);
  }
}

/** Build an unrestricted (full-access) metrics filter from the query string. */
export async function parseApiFilter(
  sp: URLSearchParams,
): Promise<{ filter: MetricsFilter; scope: { property: string; platform: string } }> {
  const { from, to } = resolveApiRange(sp);
  const platform = parsePlatform(sp.get("platform"));

  const propertyParam = sp.get("property");
  let propertyCode: string | undefined;
  if (propertyParam && propertyParam !== "all") {
    const p = await prisma.property.findFirst({
      where: { OR: [{ code: propertyParam }, { id: propertyParam }] },
      select: { code: true },
    });
    if (!p) throw new ApiError(400, `Unknown property "${propertyParam}".`);
    propertyCode = p.code;
  }

  const base = await systemMetricsFilter(from, to, propertyCode);
  return {
    filter: { ...base, platform },
    scope: { property: propertyCode ?? "all", platform: platform ?? "all" },
  };
}

/** The full reporting payload for a scope + range. */
export async function buildReportingPayload(
  filter: MetricsFilter,
  scope: { property: string; platform: string },
) {
  const [sum, plat, props, camps, ts] = await Promise.all([
    summary(filter),
    byPlatform(filter),
    byProperty(filter),
    byCampaign(filter, 1000),
    timeseries(filter),
  ]);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      from: sum.range.from,
      to: sum.range.to,
      days: sum.range.days,
      comparison: sum.previousRange,
      property: scope.property,
      platform: scope.platform,
      currency: sum.currency,
      mixedCurrency: sum.mixedCurrency,
      note:
        'KPIs for property="all" cover the top-level hotels only (matching the dashboard). ' +
        "Restaurant/spa/wellness outlets and the top-level wellness unit are in `properties[]`. " +
        "Reach is Meta-only and does not sum cleanly across days (treat multi-day totals as approximate).",
    },
    kpis: {
      ...sum.current,
      revenue: sum.revenue ? sum.revenue.now : null,
      changePct: { ...sum.changePct, revenue: sum.revenue?.changePct ?? null },
    },
    platforms: plat.platforms,
    properties: props.properties,
    campaigns: camps.campaigns,
    timeseries: ts.series,
  };
}
