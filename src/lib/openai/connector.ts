import type { NormalizedMetricRow } from "@/lib/sync/types";
import { toReportingDateString } from "@/lib/sync/dates";
import { getOpenAiAdsConfig, resolveOpenAiAdsKey, type OpenAiAdsConfig } from "./config";

// OpenAI (ChatGPT) Ads — Advertiser API connector. Pulls daily, campaign-level
// delivery insights and normalizes them into metrics_daily, exactly like the
// Google/Meta connectors. Everything here is read-only (GET).
//
//   GET {base}/ad_account/insights?aggregation_level=campaign&time_granularity=daily&fields=...
//
// Reference: https://developers.openai.com/ads/api-reference/insights (and /ads/reporting)
//
// Two documented inconsistencies are handled defensively so a doc/live mismatch
// can't silently break the pull:
//   1. Metric field names may come back BARE ("spend") or PREFIXED ("campaign.spend").
//      `pick()` reads either form.
//   2. The date-range request parameter has two documented forms; which one is
//      sent is controlled by config.dateParam (env OPENAI_ADS_DATE_PARAM), no
//      code change needed to switch.
// Spend is a plain decimal in the account currency (docs example: spend: 18.42) —
// NOT micros/cents — so no scaling is applied.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Shapes we consume -----------------------------------------------------

/** A single insight row. Keys are read defensively via `pick()`. */
export type OpenAiInsightRow = Record<string, unknown>;

interface OpenAiInsightsResponse {
  data?: OpenAiInsightRow[];
  has_more?: boolean;
  last_id?: string | null;
  first_id?: string | null;
  count?: number;
  error?: { message?: string; type?: string; code?: string | number };
}

export interface OpenAiAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone?: string;
  status?: string;
}

export interface NormalizeContext {
  propertyId: string;
  adAccountId: string;
  currency: string;
}

// ---- Field extraction (resolve dotted paths across response shapes) ---------

/**
 * Resolve a dotted field path (e.g. "campaign.spend") against a row, tolerating
 * the shapes the API might return it in: a flat dotted key
 * (row["campaign.spend"]), a nested object (row.campaign.spend), or a flat bare
 * key of the last segment (row.spend).
 */
export function getField(row: OpenAiInsightRow, path: string): unknown {
  if (row[path] !== undefined) return row[path]; // flat dotted key
  const parts = path.split(".");
  let cur: unknown = row; // nested object
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      cur = undefined;
      break;
    }
  }
  if (cur !== undefined) return cur;
  return row[parts[parts.length - 1]]; // flat bare last segment
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The reporting day for a row, as YYYY-MM-DD, from `metadata.readable_time` —
 * the API's own daily bucket. Used directly when it's already an ISO date;
 * otherwise whatever date it names is parsed and formatted in the reporting TZ.
 */
export function rowDate(row: OpenAiInsightRow, tz: string): string {
  const readable = getField(row, "readable_time");
  if (typeof readable === "string" && /^\d{4}-\d{2}-\d{2}/.test(readable)) {
    return readable.slice(0, 10);
  }
  let d: Date | null = null;
  if (typeof readable === "number") {
    d = new Date(readable < 1e12 ? readable * 1000 : readable);
  } else if (typeof readable === "string" && readable) {
    d = new Date(readable);
  }
  if (!d || Number.isNaN(d.getTime())) return "";
  return toReportingDateString(d, tz);
}

// ---- Normalization (pure, unit-testable) -----------------------------------

export function normalizeOpenAiRows(
  rows: OpenAiInsightRow[],
  ctx: NormalizeContext,
  cfg: OpenAiAdsConfig,
): NormalizedMetricRow[] {
  return rows
    .map((r) => ({
      date: rowDate(r, cfg.timezone),
      platform: "openai" as const,
      propertyId: ctx.propertyId,
      adAccountId: ctx.adAccountId,
      // The API REQUIRES `campaign.`-prefixed field names in the request, but
      // RETURNS flat snake_case keys: campaign_id, campaign_name, impressions,
      // clicks, spend, readable_time — plus a composite top-level `id` (unique
      // per row) that must NOT be used as the campaign id (doing so made every
      // campaign-day its own unnamed campaign). Parse the real response keys.
      campaignId: String(getField(r, "campaign_id") ?? ""),
      campaignName: String(getField(r, "campaign_name") ?? ""),
      impressions: toNum(getField(r, "impressions")),
      reach: 0, // OpenAI does not report reach
      clicks: toNum(getField(r, "clicks")),
      spend: toNum(getField(r, "spend")), // plain decimal in account currency
      // Conversions are NOT exposed on campaign insights fields — they live on a
      // separate POST /v1/conversions/insights endpoint. Left at 0 for now;
      // blended revenue-based ROAS still includes OpenAI spend regardless.
      conversions: 0,
      conversionValue: 0,
      currency: ctx.currency,
    }))
    // Drop rows we couldn't date or identify (keeps the upsert key clean).
    .filter((row) => row.date && row.campaignId);
}

// ---- Request building ------------------------------------------------------

// Exact field names the live API accepts (it returns the full valid set in its
// 400 error). All metric fields are `campaign.`-prefixed; the per-row day bucket
// is `metadata.readable_time`. No conversions field exists here (separate endpoint).
const INSIGHT_FIELDS = [
  "campaign.id",
  "campaign.name",
  "campaign.impressions",
  "campaign.clicks",
  "campaign.spend",
  "metadata.readable_time",
];

export function buildInsightsUrl(
  cfg: OpenAiAdsConfig,
  since: string,
  until: string,
  after?: string | null,
  limit = 100,
): string {
  const params = new URLSearchParams({
    aggregation_level: "campaign",
    time_granularity: "daily",
    limit: String(limit),
  });
  // `fields` uses the BRACKET array syntax: repeated `fields[]=<value>` keys.
  // This is dictated by the live API, which rejected every other form it was
  // tried with: a comma-joined string and a JSON-array string both error
  // "expected an array of strings, but got a string", and plain repeated
  // `fields=` keys error "Duplicate parameter: 'fields' … use the array syntax
  // instead e.g. 'fields[]=<value>'". So: `fields[]`. (Not join/JSON/plain-repeat.)
  for (const f of INSIGHT_FIELDS) params.append("fields[]", f);

  if (cfg.dateParam === "time_ranges") {
    // API-reference form: unix-second bounds.
    const toUnix = (d: string, endOfDay = false) =>
      Math.floor(new Date(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).getTime() / 1000);
    params.set("time_ranges", JSON.stringify({ unix_range: { start_time: toUnix(since), end_time: toUnix(until, true) } }));
  } else {
    // Reporting-guide form: since/until + timezone.
    params.set("date_range", JSON.stringify({ since, until, timezone: cfg.timezone }));
  }

  if (after) params.set("after", after);
  return `${cfg.baseUrl}/ad_account/insights?${params.toString()}`;
}

// ---- Fetching (auth + retry/backoff + cursor pagination) -------------------

async function fetchJson(url: string, key: string, maxAttempts = 4): Promise<OpenAiInsightsResponse> {
  let attempt = 0;
  for (;;) {
    attempt++;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      await sleep(2 ** attempt * 1000);
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      await sleep(2 ** attempt * 1000);
      continue;
    }

    const text = await res.text();
    let json: OpenAiInsightsResponse;
    try {
      json = text ? (JSON.parse(text) as OpenAiInsightsResponse) : {};
    } catch {
      throw new Error(`OpenAI Ads API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok || json.error) {
      const msg = json.error?.message ?? text.slice(0, 200) ?? res.statusText;
      throw new Error(`OpenAI Ads API error (HTTP ${res.status}): ${msg}`);
    }
    return json;
  }
}

/** Page through all insight rows for a window via the `after`/`last_id` cursor. */
export async function fetchAllInsights(
  cfg: OpenAiAdsConfig,
  key: string,
  since: string,
  until: string,
): Promise<OpenAiInsightRow[]> {
  const rows: OpenAiInsightRow[] = [];
  let after: string | null | undefined;
  for (let page = 0; page < 500; page++) {
    const json = await fetchJson(buildInsightsUrl(cfg, since, until, after), key);
    rows.push(...(json.data ?? []));
    if (!json.has_more || !json.last_id) break;
    after = json.last_id;
  }
  return rows;
}

/** GET {base}/ad_account — verify the key and read the account's id/currency/tz. */
export async function fetchAdAccount(cfg: OpenAiAdsConfig, key: string): Promise<OpenAiAdAccount> {
  const url = `${cfg.baseUrl}/ad_account`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI Ads /ad_account error (HTTP ${res.status}): ${text.slice(0, 200)}`);
  const a = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  const id = String(a.id ?? a.account_id ?? a.ad_account_id ?? "");
  if (!id) throw new Error("OpenAI Ads /ad_account did not return an account id.");
  return {
    id,
    name: String(a.name ?? a.account_name ?? id),
    currency: String(a.currency ?? "").toUpperCase(),
    timezone: a.timezone ? String(a.timezone) : a.time_zone ? String(a.time_zone) : undefined,
    status: a.status ? String(a.status) : undefined,
  };
}

/** Fetch + normalize one OpenAI ad account's daily campaign metrics for a range. */
export async function fetchDailyMetrics(
  externalAccountId: string,
  startDate: string,
  endDate: string,
  ctx: NormalizeContext,
): Promise<NormalizedMetricRow[]> {
  const cfg = getOpenAiAdsConfig();
  const key = await resolveOpenAiAdsKey();
  try {
    const rows = await fetchAllInsights(cfg, key, startDate, endDate);
    return normalizeOpenAiRows(rows, ctx, cfg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI Ads sync for account ${externalAccountId} failed: ${msg}`);
  }
}
