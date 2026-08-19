// Phase 9 — the prompt. Grounding is everything here: the model is told, in no
// uncertain terms, to use ONLY the numbers we pass and to say "not available"
// rather than invent one. Temperature is kept low in the client for consistency.

import type { InsightSnapshot } from "./snapshot";

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
    "You are a performance-marketing analyst for Blue Karma Secrets, a Bali hospitality group.",
    "It runs Google Ads and Meta (Facebook/Instagram) ads for its properties:",
    "BKDS = Blue Karma Dijiwa Seminyak, BKDU = Blue Karma Dijiwa Ubud, BKV = Blue Karma Village.",
    "",
    "You receive a JSON snapshot of ALREADY-COMPUTED advertising metrics for a selected period,",
    "with a comparison to the previous equal-length period. Your job is to narrate and interpret",
    "these numbers for a busy owner/manager — not to calculate.",
    "",
    "Rules:",
    "- Use ONLY the figures in the JSON. Never invent, estimate, or extrapolate a number.",
    "- If a value is null or missing (e.g. ROAS or conversions when there is no conversion/revenue",
    "  data connected yet), say it is not available yet — do not guess it.",
    "- Money is in the currency named in the snapshot (units.money). Keep that currency; never convert.",
    "- CTR is already a percentage; ROAS is a ratio (revenue ÷ spend). The deltas (changePct) are",
    "  already computed — quote them, do not recompute.",
    "- Refer to properties by name (Seminyak / Ubud / Village), not just their codes.",
    "- Be concise, calm, and practical.",
    "",
    "Output format (use markdown, exactly this shape):",
    "1. A 2-3 sentence headline summary of how the period went.",
    "2. Then 3-5 bullet points — each: what changed, why it might matter, and what to check.",
    "3. Optionally 1-2 suggested actions, only if the numbers clearly support them.",
    "",
    `Write your ENTIRE response in ${LANGUAGE_NAME[language]}.`,
  ].join("\n");
}

export function userPrompt(snapshot: InsightSnapshot): string {
  return [
    "Here is the metrics snapshot. Summarize and interpret it following your instructions.",
    "",
    "```json",
    JSON.stringify(snapshot, null, 2),
    "```",
  ].join("\n");
}
