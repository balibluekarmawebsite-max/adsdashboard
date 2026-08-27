// Assembles everything an export (PDF / PPTX / XLSX) needs for the current view,
// reusing the same aggregations the dashboard renders. Read-only.

import { prisma } from "@/lib/db";
import type { MetricsFilter } from "@/lib/metrics/query";
import { summary, timeseries, byProperty, byCampaign } from "@/lib/metrics/query";
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
  kpis: ReportKpis;
  series: ReportSeriesPoint[];
  breakdown: { kind: "units" | "campaigns"; title: string; rows: ReportRow[] };
  aiSummary: string | null;
}

function platformLabelOf(platform: MetricsFilter["platform"]): string {
  if (platform === "google") return "Google Ads";
  if (platform === "meta") return "Meta Ads";
  return "All platforms";
}

export async function buildReport(filter: MetricsFilter): Promise<ReportModel> {
  const [sum, ts] = await Promise.all([summary(filter), timeseries(filter)]);

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
    kpis: {
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.ctr,
      cpc: c.cpc,
      conversions: c.conversions,
      roas: c.roas,
      revenue: sum.revenue ? sum.revenue.now : null,
      changePct: sum.changePct,
    },
    series: ts.series.map((s) => ({
      date: s.date,
      spend: s.spend,
      impressions: s.impressions,
      clicks: s.clicks,
      conversions: s.conversions,
    })),
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
