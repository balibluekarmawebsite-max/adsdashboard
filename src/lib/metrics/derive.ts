// Derived metrics are computed on read (never stored). Every division is guarded
// against a zero denominator — returns null so the UI can render "—" honestly.

export interface Totals {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

export interface DerivedKpis {
  ctr: number | null; // clicks / impressions
  cpc: number | null; // spend / clicks
  cpm: number | null; // spend / impressions * 1000
  cvr: number | null; // conversions / clicks
  roas: number | null; // conversionValue / spend
}

export type Summary = Totals & DerivedKpis;

export function safeDiv(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveKpis(t: Totals): DerivedKpis {
  return {
    ctr: safeDiv(t.clicks, t.impressions),
    cpc: safeDiv(t.spend, t.clicks),
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    cvr: safeDiv(t.conversions, t.clicks),
    roas: safeDiv(t.conversionValue, t.spend),
  };
}

export function summarize(t: Totals): Summary {
  return { ...t, ...deriveKpis(t) };
}

/** Percentage change vs a previous value; null when not computable. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
