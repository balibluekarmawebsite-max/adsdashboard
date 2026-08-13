// Human-friendly formatting, defined once and reused across the dashboard.

const DASH = "—";

/** Full integer with thousands separators. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return DASH;
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/** Compact large counts: 12.3K / 1.2M; plain below 1000. */
export function formatCompact(value: number | null | undefined): string {
  if (value == null) return DASH;
  if (Math.abs(value) < 1000) return formatNumber(value);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

/**
 * Money in an account currency. When currency is null (mixed across accounts),
 * fall back to a plain compact number so we never imply a single currency.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: string | null,
  opts?: { compact?: boolean },
): string {
  if (value == null) return DASH;
  if (!currency) return formatCompact(value);
  const zeroDecimal = currency === "IDR" || currency === "JPY";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: opts?.compact && Math.abs(value) >= 1000 ? "compact" : "standard",
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? (opts?.compact ? 1 : 0) : 2,
  }).format(value);
}

/** A ratio (CTR/CVR 0.032) as a percent string. */
export function formatRatioPct(value: number | null | undefined, decimals = 2): string {
  if (value == null) return DASH;
  return `${(value * 100).toFixed(decimals)}%`;
}

/** ROAS ratio (10 → "10.00×"). */
export function formatRoas(value: number | null | undefined, decimals = 2): string {
  if (value == null) return DASH;
  return `${value.toFixed(decimals)}×`;
}

/** A period-over-period % change (already a percentage number, e.g. 25 → "+25.0%"). */
export function formatDelta(pct: number | null | undefined, decimals = 1): string {
  if (pct == null) return DASH;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}
