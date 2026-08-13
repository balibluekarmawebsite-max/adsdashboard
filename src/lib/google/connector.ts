import type { NormalizedMetricRow } from "@/lib/sync/types";
import { getGoogleCustomer } from "./client";

// The GAQL fields we read (campaign level, one row per day).
export function buildCampaignGaql(startDate: string, endDate: string): string {
  return [
    "SELECT campaign.id, campaign.name, segments.date,",
    "       metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "       metrics.conversions, metrics.conversions_value",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    "ORDER BY segments.date",
  ].join("\n");
}

// Subset of the google-ads-api row shape that we consume.
export interface GoogleAdsRow {
  campaign?: { id?: number | string | null; name?: string | null } | null;
  segments?: { date?: string | null } | null;
  metrics?: {
    impressions?: number | string | null;
    clicks?: number | string | null;
    cost_micros?: number | string | null;
    conversions?: number | string | null;
    conversions_value?: number | string | null;
  } | null;
}

export interface NormalizeContext {
  propertyId: string;
  adAccountId: string;
  currency: string;
}

/**
 * Pure normalizer (unit-testable): map raw GAQL rows to metricsDaily columns.
 * Key gotcha: cost_micros ÷ 1,000,000 to get the real currency amount.
 */
export function normalizeGoogleRows(
  rows: GoogleAdsRow[],
  ctx: NormalizeContext,
): NormalizedMetricRow[] {
  return rows.map((row) => {
    const m = row.metrics ?? {};
    return {
      date: String(row.segments?.date ?? ""),
      platform: "google",
      propertyId: ctx.propertyId,
      adAccountId: ctx.adAccountId,
      campaignId: String(row.campaign?.id ?? ""),
      campaignName: String(row.campaign?.name ?? ""),
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      spend: Number(m.cost_micros ?? 0) / 1_000_000,
      conversions: Number(m.conversions ?? 0),
      conversionValue: Number(m.conversions_value ?? 0),
      currency: ctx.currency,
    };
  });
}

/** Fetch + normalize one account's daily campaign metrics for a date range. */
export async function fetchDailyMetrics(
  externalAccountId: string,
  startDate: string,
  endDate: string,
  ctx: NormalizeContext,
): Promise<NormalizedMetricRow[]> {
  const customer = await getGoogleCustomer(externalAccountId);
  const rows = await customer.query<GoogleAdsRow[]>(buildCampaignGaql(startDate, endDate));
  return normalizeGoogleRows(rows, ctx);
}
