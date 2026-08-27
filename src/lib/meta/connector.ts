import type { NormalizedMetricRow } from "@/lib/sync/types";
import { CONVERSION_ACTION_TYPES } from "@/config/conversions";
import { getMetaConfig, resolveMetaToken, normalizeMetaAccountId } from "./config";

const GRAPH = "https://graph.facebook.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Shapes we consume from the Insights API ------------------------------

export interface MetaAction {
  action_type: string;
  value?: string | number;
}

export interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string | number;
  clicks?: string | number;
  spend?: string | number;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

interface InsightsResponse {
  data?: MetaInsightRow[];
  paging?: { next?: string; cursors?: { before?: string; after?: string } };
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

export interface NormalizeContext {
  propertyId: string;
  adAccountId: string;
  currency: string;
}

// ---- Normalization (pure, unit-testable) ----------------------------------

/** Sum the values of the actions whose action_type is in `types`. */
export function sumActions(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  const wanted = new Set(types);
  return actions.reduce(
    (total, a) => (wanted.has(a.action_type) ? total + Number(a.value ?? 0) : total),
    0,
  );
}

/**
 * Map Insights rows to metrics_daily columns. Everything Meta returns is a
 * STRING, so numeric fields are parsed. Conversions come from the actions array.
 */
export function normalizeMetaRows(
  rows: MetaInsightRow[],
  ctx: NormalizeContext,
  conversionTypes: string[] = CONVERSION_ACTION_TYPES,
): NormalizedMetricRow[] {
  return rows.map((r) => ({
    date: String(r.date_start ?? ""),
    platform: "meta",
    propertyId: ctx.propertyId,
    adAccountId: ctx.adAccountId,
    campaignId: String(r.campaign_id ?? ""),
    campaignName: String(r.campaign_name ?? ""),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.spend ?? 0), // already in account currency
    conversions: sumActions(r.actions, conversionTypes),
    conversionValue: sumActions(r.action_values, conversionTypes),
    currency: ctx.currency,
  }));
}

// ---- Fetching (pagination + rate-limit awareness) -------------------------

export function buildInsightsUrl(
  apiVersion: string,
  accountId: string,
  since: string,
  until: string,
  token: string,
  limit = 200,
): string {
  const params = new URLSearchParams({
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values",
    limit: String(limit),
    access_token: token,
  });
  return `${GRAPH}/${apiVersion}/act_${accountId}/insights?${params.toString()}`;
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004]);

/** Back off when the Business-Use-Case usage header approaches the limit (~80%). */
async function backoffOnUsage(header: string | null): Promise<void> {
  if (!header) return;
  try {
    const usage = JSON.parse(header) as Record<
      string,
      Array<{
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
        estimated_time_to_regain_access?: number;
      }>
    >;
    let maxPct = 0;
    let regainMinutes = 0;
    for (const entries of Object.values(usage)) {
      for (const e of entries) {
        maxPct = Math.max(maxPct, e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0);
        regainMinutes = Math.max(regainMinutes, e.estimated_time_to_regain_access ?? 0);
      }
    }
    if (regainMinutes > 0) await sleep(Math.min(regainMinutes, 5) * 60_000);
    else if (maxPct >= 80) await sleep(30_000);
  } catch {
    // Header not parseable — ignore.
  }
}

async function fetchWithRetry(url: string, maxAttempts = 4): Promise<Response> {
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= maxAttempts) return res;
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      await sleep(2 ** attempt * 1000);
    }
  }
}

/** Follow paging.next until all rows are fetched. */
export async function fetchAllInsights(startUrl: string): Promise<MetaInsightRow[]> {
  const rows: MetaInsightRow[] = [];
  let next: string | null = startUrl;
  let rateLimitAttempts = 0;
  const MAX_RATE_LIMIT_ATTEMPTS = 3; // ~45s of backoff total, then give up cleanly

  while (next) {
    const res = await fetchWithRetry(next);
    await backoffOnUsage(res.headers.get("x-business-use-case-usage"));

    const json = (await res.json()) as InsightsResponse;
    if (json.error) {
      const { code, message } = json.error;
      const retryable = code !== undefined && RATE_LIMIT_CODES.has(code);
      // On a rate limit, wait it out and retry the SAME page a few times before
      // failing — transient throttles usually clear within a few seconds.
      if (retryable && rateLimitAttempts < MAX_RATE_LIMIT_ATTEMPTS) {
        rateLimitAttempts++;
        await sleep((5 + 10 * rateLimitAttempts) * 1000); // 15s, 25s, 35s
        continue;
      }
      if (retryable) {
        throw new Error(
          `Meta is rate-limiting requests (code ${code}). Wait a few minutes and Refresh again — Google is unaffected.`,
        );
      }
      throw new Error(`Meta API error ${code}: ${message}`);
    }

    rateLimitAttempts = 0; // page succeeded — reset for the next possible stall
    rows.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }

  return rows;
}

/** Fetch + normalize one Meta account's daily campaign metrics for a date range. */
export async function fetchDailyMetrics(
  externalAccountId: string,
  startDate: string,
  endDate: string,
  ctx: NormalizeContext,
): Promise<NormalizedMetricRow[]> {
  const { apiVersion } = getMetaConfig();
  const token = await resolveMetaToken();
  const url = buildInsightsUrl(
    apiVersion,
    normalizeMetaAccountId(externalAccountId),
    startDate,
    endDate,
    token,
  );
  const rows = await fetchAllInsights(url);
  return normalizeMetaRows(rows, ctx);
}
