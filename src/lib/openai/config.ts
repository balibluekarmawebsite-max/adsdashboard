import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

// OpenAI (ChatGPT) Ads — Advertiser API configuration.
// Docs: https://developers.openai.com/ads  ·  Base: https://api.ads.openai.com/v1
// The API key is a Bearer token scoped to ONE ad account, issued from the OpenAI
// Ads Manager (NOT platform.openai.com). It is stored encrypted in
// platform_connections (see `npm run connect:openai`) or read from the env.

export interface OpenAiAdsConfig {
  /** API base, including the version prefix. */
  baseUrl: string;
  /**
   * Which date-range query parameter form to send on insights calls. OpenAI's
   * own docs are inconsistent here, so this is switchable WITHOUT a redeploy:
   *  - "date_range"  → ?date_range={"since","until","timezone"}   (reporting guide)
   *  - "time_ranges" → ?time_ranges={"unix_range":{start_time,end_time}} (API ref)
   * Default follows the reporting guide; set OPENAI_ADS_DATE_PARAM=time_ranges to flip.
   */
  dateParam: "date_range" | "time_ranges";
  /** Reporting timezone used for day bucketing + the date_range param. */
  timezone: string;
}

export function getOpenAiAdsConfig(): OpenAiAdsConfig {
  const baseUrl = (process.env.OPENAI_ADS_API_BASE ?? "https://api.ads.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const dateParam = process.env.OPENAI_ADS_DATE_PARAM === "time_ranges" ? "time_ranges" : "date_range";
  const timezone = process.env.SYNC_TIMEZONE ?? "Asia/Makassar";
  return { baseUrl, dateParam, timezone };
}

/**
 * Resolve the OpenAI Ads API key: prefer the encrypted DB-stored connection
 * (see `npm run connect:openai`), then fall back to OPENAI_ADS_API_KEY.
 */
export async function resolveOpenAiAdsKey(): Promise<string> {
  const connection = await prisma.platformConnection.findFirst({
    where: { platform: "openai", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (connection) return decryptSecret(connection.secretEncrypted);

  if (process.env.OPENAI_ADS_API_KEY) return process.env.OPENAI_ADS_API_KEY;

  throw new Error(
    "No OpenAI Ads key available. Set OPENAI_ADS_API_KEY, or run `npm run connect:openai` to store one.",
  );
}
