// Shared shape both connectors (Google, Meta) normalize into before upsert.
export type PlatformName = "google" | "meta";

export interface NormalizedMetricRow {
  date: string; // YYYY-MM-DD (in the account's reporting timezone)
  platform: PlatformName;
  propertyId: string;
  adAccountId: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  reach: number; // unique people reached (Meta only; 0 for Google)
  clicks: number;
  spend: number; // in the account currency (Google cost_micros already ÷ 1e6)
  conversions: number;
  conversionValue: number;
  currency: string; // ISO 4217, e.g. "IDR"
}

export interface AccountSyncResult {
  externalAccountId: string;
  ok: boolean;
  rowsWritten: number;
  error?: string;
}
