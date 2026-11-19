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

// ---- Field extraction (handles bare vs prefixed keys) ----------------------

/** Read a field that may be flat ("spend") or namespaced ("campaign.spend"). */
export function pick(row: OpenAiInsightRow, name: string): unknown {
  if (row[name] !== undefined) return row[name];
  for (const prefix of ["campaign", "metadata", "metrics"]) {
    const v = row[`${prefix}.${name}`];
    if (v !== undefined) return v;
  }
  return undefined;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The reporting day for a row, as YYYY-MM-DD. Prefer `readable_time` when it's
 * already an ISO date (the API's own daily bucket); otherwise derive it from
 * `start_time` (unix seconds/ms or an ISO string), converted to the reporting TZ.
 */
export function rowDate(row: OpenAiInsightRow, tz: string): string {
  const readable = pick(row, "readable_time");
  if (typeof readable === "string" && /^\d{4}-\d{2}-\d{2}$/.test(readable)) return readable;

  const start = pick(row, "start_time") ?? readable;
  let d: Date | null = null;
  if (typeof start === "number") {
    d = new Date(start < 1e12 ? start * 1000 : start);
  } else if (typeof start === "string") {
    d = /^\d+$/.test(start)
      ? new Date(Number(start) < 1e12 ? Number(start) * 1000 : Number(start))
      : new Date(start);
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
      campaignId: String(pick(r, "campaign_id") ?? pick(r, "id") ?? ""),
      campaignName: String(pick(r, "campaign_name") ?? pick(r, "name") ?? ""),
      impressions: toNum(pick(r, "impressions")),
      reach: 0, // OpenAI does not report reach
      clicks: toNum(pick(r, "clicks")),
      spend: toNum(pick(r, "spend")), // plain decimal in the account currency
      conversions: toNum(pick(r, "conversions")),
      conversionValue: toNum(pick(r, "conversion_value") ?? pick(r, "conversions_value")),
      currency: ctx.currency,
    }))
    // Drop rows we couldn't date or identify (keeps the upsert key clean).
    .filter((row) => row.date && row.campaignId);
}

// ---- Request building ------------------------------------------------------

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "readable_time",
  "start_time",
  "impressions",
  "clicks",
  "spend",
  "conversions",
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
  // `fields` is an array-of-strings query param: express it as REPEATED keys
  // (fields=a&fields=b&…) — the standard array-in-querystring encoding. The live
  // API rejects BOTH a comma-joined string AND a JSON-array string with
  // "Invalid type for 'fields': expected an array of strings, but got a string
  // instead", because it does not JSON-parse this param; only repeated keys
  // deserialize to an array. (Do not use .join(",") or JSON.stringify here.)
  for (const f of INSIGHT_FIELDS) params.append("fields", f);

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
