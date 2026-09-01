// Phase 9 — the prompt. Grounding is everything here: the model is told, in no
// uncertain terms, to use ONLY the numbers we pass and to say "not available"
// rather than invent one. Temperature is kept low in the client for consistency.
//
// Numbers are pre-formatted in FULL (with thousands separators) before they reach
// the model, and the prompt forbids any abbreviation — so the owner report reads
// "281,451,000 IDR", never "281 million IDR".

import type { InsightSnapshot, Kpi } from "./snapshot";

export type InsightLanguage = "en" | "id";

export const LANGUAGE_NAME: Record<InsightLanguage, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export function isLanguage(v: unknown): v is InsightLanguage {
  return v === "en" || v === "id";
}

export function systemPrompt(language: InsightLanguage): string {
  return [
    "You are preparing a concise advertising performance HIGHLIGHT report for the OWNER of Blue Karma",
    "Secrets, a Bali hospitality group running Google Ads and Meta (Facebook/Instagram) ads for its",
    "properties: BKDS = Blue Karma Dijiwa Seminyak, BKDU = Blue Karma Dijiwa Ubud, BKV = Blue Karma Village.",
    "",
    "You receive a JSON snapshot of ALREADY-COMPUTED metrics for a selected period, with a comparison to",
    "the previous equal-length period. Turn it into a short, positive, owner-ready highlight report.",
    "",
    "Grounding rules (never break these):",
    "- Use ONLY the figures in the JSON. Never invent, estimate, or recompute a number; deltas are given.",
    "- Money is in the currency named in the snapshot (units.money); keep it. CTR is a percentage; ROAS is",
    "  a ratio (revenue ÷ spend). If a value is null (e.g. revenue not entered yet), simply omit it — do",
    "  not guess, and do not describe it as a problem.",
    "- Refer to properties by name (Seminyak / Ubud / Village).",
    "",
    "Number formatting (CRITICAL — never break):",
    "- Every money and count value in the snapshot is ALREADY written in full with thousands separators.",
    "  Reproduce each number EXACTLY as given, digit for digit, keeping the separators (e.g. 281,451,000).",
    "- NEVER abbreviate, round, or shorten a number. Do NOT use 'million', 'M', 'K', 'thousand', 'billion',",
    "  'bn', 'B', 'juta', 'ribu', 'rb', or scientific notation.",
    "- Examples: write '281,451,000 IDR', NOT '281 million IDR'; write '3,650,000 IDR', NOT '3.65 million",
    "  IDR'; write '23,145,000 IDR', NOT '23 million IDR'.",
    "- Write money as the full number followed by the currency from units.money (e.g. '281,451,000 IDR').",
    "  CTR stays a percentage (e.g. 3.14%); ROAS stays a ratio (e.g. 12.14×); growth stays a percentage.",
    "",
    "Tone & focus (this is a report to the owner):",
    "- Lead with what is going WELL: strong ROAS, top-performing properties and campaigns, efficient spend,",
    "  and growth versus the previous period. Keep it confident and positive.",
    "- Do NOT dwell on problems or use negative language. If something could be improved, mention it only in",
    "  Recommendations, briefly and constructively — framed as an opportunity to grow, never as a fault.",
    "",
    "Output format — ALWAYS use exactly these three markdown sections, in this order:",
    "**Headline** — 2-3 sentences on how the period went, positive and factual.",
    "**Highlights** — 3-5 bullets of what went well, each citing the specific number (ROAS, revenue, spend,",
    "top property or campaign, CTR, growth %).",
    "**Recommendations** — 2-3 short, practical bullets on how to build on this success or capture the next",
    "opportunity.",
    "",
    `Write the ENTIRE report in ${LANGUAGE_NAME[language]}.`,
  ].join("\n");
}

/** Group a number with thousands separators (full, never abbreviated). */
function grp(n: number | null | undefined): string | null {
  return n == null ? null : Number(n).toLocaleString("en-US");
}

/** Money/count fields become full grouped strings so the model can't abbreviate. */
function displaySnapshot(s: InsightSnapshot): Record<string, unknown> {
  const money = (k: Kpi) => ({ now: grp(k.now), prev: grp(k.prev), changePct: k.changePct });
  return {
    ...s,
    kpis: {
      spend: money(s.kpis.spend),
      impressions: money(s.kpis.impressions),
      clicks: money(s.kpis.clicks),
      ctr: s.kpis.ctr, // percentage — leave as-is
      cpc: money(s.kpis.cpc),
      conversions: money(s.kpis.conversions),
      roas: s.kpis.roas, // ratio — leave as-is
    },
    revenue: s.revenue
      ? { now: grp(s.revenue.now), prev: grp(s.revenue.prev), changePct: s.revenue.changePct }
      : null,
    byPlatform: s.byPlatform.map((p) => ({
      ...p,
      spend: grp(p.spend),
      impressions: grp(p.impressions),
      clicks: grp(p.clicks),
      conversions: grp(p.conversions),
    })),
    byProperty: s.byProperty.map((p) => ({ ...p, spend: grp(p.spend), conversions: grp(p.conversions) })),
    topCampaigns: s.topCampaigns.map((c) => ({ ...c, spend: grp(c.spend) })),
    biggestMovers: s.biggestMovers.map((m) => ({
      ...m,
      spendNow: grp(m.spendNow),
      spendPrev: grp(m.spendPrev),
    })),
  };
}

export function userPrompt(snapshot: InsightSnapshot): string {
  return [
    "Here is the metrics snapshot. Summarize and interpret it following your instructions.",
    "Every money and count below is already the FULL number — quote them exactly, never abbreviate.",
    "",
    "```json",
    JSON.stringify(displaySnapshot(snapshot), null, 2),
    "```",
  ].join("\n");
}
