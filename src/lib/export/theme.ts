// Single source of truth for the look of every exported report — the PDF/print
// page, the emailed HTML, and the PPTX — so all three match each other and the
// live dashboard. The hex values are the dashboard's own light-theme tokens
// (see globals.css), and the delta colouring reuses the dashboard's favorable
// logic so a "good" change is green and a "bad" one is red everywhere.

import { sentiment, type Sentiment } from "@/lib/metrics/favorable";

export { sentiment };
export type { Sentiment };

export const BRAND = {
  navy: "#00587c", //  --primary       (brand blue)
  ink: "#28334a", //   --foreground    (brand navy text)
  muted: "#63666a", // --muted-foreground
  border: "#e2e5e8", //--border
  tile: "#f4f6f8", //  soft tile surface (near --muted)
  accent: "#e7f0fb", //--accent         (sky tint)
  positive: "#059669", // emerald-600   (favorable)
  negative: "#d64545", // --destructive (unfavorable)
  google: "#2a78d6", //--chart-1        (Google)
  meta: "#eb6834", //  --chart-2        (Meta)
  white: "#ffffff",
} as const;

export const SENTIMENT_HEX: Record<Sentiment, string> = {
  positive: BRAND.positive,
  negative: BRAND.negative,
  neutral: BRAND.muted,
};

/** ▲ up / ▼ down / • flat — matches the dashboard KPI cards. */
export function deltaArrow(pct: number | null | undefined): string {
  if (pct == null) return "";
  return pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
}

/** Colour for a delta, by whether the change is favorable for that metric. */
export function deltaHex(metric: string, pct: number | null | undefined): string {
  return SENTIMENT_HEX[sentiment(metric, pct)];
}

/** Brand colour for a platform dot / bar. */
export function platformHex(platform: string | null | undefined): string {
  const p = (platform ?? "").toLowerCase();
  if (p === "google") return BRAND.google;
  if (p === "meta") return BRAND.meta;
  return BRAND.navy;
}

/** pptxgenjs wants hex with no leading '#'. */
export function pptxColor(hex: string): string {
  return hex.replace(/^#/, "").toUpperCase();
}
