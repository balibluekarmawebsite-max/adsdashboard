// Assembles everything an export (PDF / PPTX / XLSX) needs for the current view,
// reusing the same aggregations the dashboard renders. Read-only.

import { prisma } from "@/lib/db";
import type { MetricsFilter } from "@/lib/metrics/query";
import { summary, timeseries, byPlatform, byProperty, byCampaign } from "@/lib/metrics/query";
import { kindLabel } from "@/lib/properties";

export interface ReportKpis {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  conversions: number;
  roas: number | null;
  revenue: number | null;
  changePct: Record<string, number | null>;
}

export interface ReportSeriesPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface ReportRow {
  label: string;
  sublabel?: string;
  platform?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  roas: number | null;
  revenue?: number | null;
}

/** One channel's slice of total spend — powers the "Google vs Meta" split. */
export interface ReportPlatformSplit {
  platform: string; // "google" | "meta" | …
  label: string; // "Google" | "Meta"
  spend: number;
  conversions: number;
  roas: number | null;
  sharePct: number; // 0–100 of total spend across platforms
}

export interface ReportModel {
  scope: {
    propertyLabel: string;
    platformLabel: string;
    from: string;
    to: string;
    days: number;
    generatedAt: string;
    currency: string | null;
    mixedCurrency: boolean;
  };
  /** The immediately-preceding equal-length period the % changes compare against. */
  comparison: { from: string; to: string };
  /** When false, a global setting hides all period-over-period variance. */
  showVariance: boolean;
  kpis: ReportKpis;
  series: ReportSeriesPoint[];
  platformSplit: ReportPlatformSplit[];
  breakdown: { kind: "units" | "campaigns"; title: string; rows: ReportRow[] };
  aiSummary: string | null;
}

function platformShortLabel(platform: string): string {
  if (platform === "google") return "Google";
  if (platform === "meta") return "Meta";
  return platform.replace(/^\w/, (m) => m.toUpperCase());
}

function platformLabelOf(platform: MetricsFilter["platform"]): string {
  if (platform === "google") return "Google Ads";
  if (platform === "meta") return "Meta Ads";
  return "All platforms";
}

export async function buildReport(filter: MetricsFilter): Promise<ReportModel> {
  const [sum, ts, plat] = await Promise.all([
    summary(filter),
    timeseries(filter),
    byPlatform(filter),
  ]);

  // Spend share by channel (Google vs Meta), highest spend first.
  const totalPlatformSpend = plat.platforms.reduce((s, p) => s + p.spend, 0);
  const platformSplit: ReportPlatformSplit[] = plat.platforms
    .map((p) => ({
      platform: p.platform,
      label: platformShortLabel(p.platform),
      spend: p.spend,
      conversions: p.conversions,
      roas: p.roas,
      sharePct: totalPlatformSpend > 0 ? (p.spend / totalPlatformSpend) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  // What is this report about?
  let propertyLabel = "All hotels";
  if (filter.propertyId) {
    const p = await prisma.property.findUnique({
      where: { id: filter.propertyId },
      select: { code: true, name: true, kind: true, parent: { select: { code: true } } },
    });
    if (p) {
      propertyLabel = p.parent
        ? `${p.name} — ${kindLabel(p.kind)} · ${p.parent.code}`
        : `${p.name} (${p.code})`;
    }
  }

  // Single property/outlet → its top campaigns; the "all" view → per-hotel split.
  let breakdown: ReportModel["breakdown"];
  if (filter.propertyId) {
    const bc = await byCampaign(filter, 25);
    breakdown = {
      kind: "campaigns",
      title: "Top campaigns by spend",
      rows: bc.campaigns.map((c) => ({
        label: c.campaignName,
        platform: c.platform,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        ctr: c.ctr,
        roas: c.roas,
      })),
    };
  } else {
    const bp = await byProperty(filter);
    breakdown = {
      kind: "units",
      title: "By hotel",
      rows: bp.properties.map((p) => ({
        label: p.name ?? p.code ?? "—",
        sublabel: p.code ?? undefined,
        spend: p.spend,
        impressions: p.impressions,
        clicks: p.clicks,
        conversions: p.conversions,
        ctr: p.ctr,
        roas: p.roas,
        revenue: p.revenue,
      })),
    };
  }

  // Include the last AI owner-summary for exactly this view, if one was already
  // generated. Never generate on export (keeps it fast and free).
  const ai = await prisma.aiSummary.findFirst({
    where: {
      periodFrom: filter.from,
      periodTo: filter.to,
      property: filter.propertyId ?? "all",
      platform: filter.platform ?? "all",
      language: "en",
    },
    orderBy: { generatedAt: "desc" },
    select: { summaryText: true },
  });

  const c = sum.current;
  return {
    scope: {
      propertyLabel,
      platformLabel: platformLabelOf(filter.platform),
      from: sum.range.from,
      to: sum.range.to,
      days: sum.range.days,
      generatedAt: new Date().toISOString(),
      currency: sum.currency,
      mixedCurrency: sum.mixedCurrency,
    },
    comparison: { from: sum.previousRange.from, to: sum.previousRange.to },
    showVariance: sum.showVariance,
    kpis: {
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.ctr,
      cpc: c.cpc,
      conversions: c.conversions,
      roas: c.roas,
      revenue: sum.revenue ? sum.revenue.now : null,
      // Revenue change lives on sum.revenue (not sum.changePct) — fold it in so
      // the exports can colour a Revenue delta like the dashboard does.
      changePct: { ...sum.changePct, revenue: sum.revenue?.changePct ?? null },
    },
    series: ts.series.map((s) => ({
      date: s.date,
      spend: s.spend,
      impressions: s.impressions,
      clicks: s.clicks,
      conversions: s.conversions,
    })),
    platformSplit,
    breakdown,
    aiSummary: ai?.summaryText ?? null,
  };
}

/** A filename-safe slug for the current scope, e.g. "all-hotels_2026-08-01_2026-08-27". */
export function reportSlug(model: ReportModel): string {
  const scopePart = model.scope.propertyLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${scopePart}_${model.scope.from}_${model.scope.to}`;
}
