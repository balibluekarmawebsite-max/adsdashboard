import { inspect } from "node:util";
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

/**
 * google-ads-api throws a structured failure object (an `errors` array with
 * message + error_code), which `String(err)` renders as "[object Object]".
 * Dig out the real detail; fall back to a full inspect so nothing is hidden.
 */
function describeGoogleAdsError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const errors = e.errors as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(errors) && errors.length > 0) {
      const parts = errors.map((item) => {
        const message = typeof item.message === "string" ? item.message : "";
        const codeObj = (item.error_code ?? {}) as Record<string, unknown>;
        const codeKey = Object.keys(codeObj)[0];
        const code = codeKey ? `${codeKey}=${String(codeObj[codeKey])}` : "";
        return [code, message].filter(Boolean).join(": ");
      });
      const reqId = typeof e.request_id === "string" ? ` (request_id: ${e.request_id})` : "";
      return parts.join(" | ") + reqId;
    }
    if (typeof e.message === "string" && e.message) return e.message;
    return inspect(err, { depth: 4 });
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Turn an opaque google-ads-api failure into an actionable Error. Adds a
 * setup hint for the common not-enabled / not-approved cases.
 */
function explainGoogleAdsError(err: unknown): Error {
  const detail = describeGoogleAdsError(err);
  if (/reading 'get'|No data type found|SERVICE_DISABLED|DEVELOPER_TOKEN|not been used|is disabled|not approved/i.test(detail)) {
    return new Error(
      `${detail} — confirm the Google Ads API is enabled ` +
        `(https://console.cloud.google.com/apis/library/googleads.googleapis.com) and that your ` +
        `developer token has Basic Access approved in API Center.`,
    );
  }
  return new Error(`Google Ads API call failed: ${detail}`);
}

/** Fetch + normalize one account's daily campaign metrics for a date range. */
export async function fetchDailyMetrics(
  externalAccountId: string,
  startDate: string,
  endDate: string,
  ctx: NormalizeContext,
): Promise<NormalizedMetricRow[]> {
  const customer = await getGoogleCustomer(externalAccountId);
  let rows: GoogleAdsRow[];
  try {
    rows = await customer.query<GoogleAdsRow[]>(buildCampaignGaql(startDate, endDate));
  } catch (err) {
    throw explainGoogleAdsError(err);
  }
  return normalizeGoogleRows(rows, ctx);
}
