// Phase 9 — the Groq client. Groq exposes an OpenAI-compatible endpoint, so we
// call it with plain fetch (no extra dependency to install on the server). The
// API key is read from the environment and NEVER leaves the server.

import { systemPrompt, userPrompt, type InsightLanguage } from "./prompt";
import type { InsightSnapshot } from "./snapshot";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

/** Model is a config value, not hardcoded — Groq's lineup changes often. */
export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export interface GeneratedSummary {
  text: string;
  model: string;
  tokenUsage: number;
}

/**
 * Ask Groq to phrase a pre-computed snapshot in the requested language.
 * Low temperature for grounded, consistent output. Throws on any failure so the
 * caller can fall back to a cached summary (never break the dashboard).
 */
export async function generateSummary(
  snapshot: InsightSnapshot,
  language: InsightLanguage,
): Promise<GeneratedSummary> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — add it to .env to enable AI insights.");
  const model = getGroqModel();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(language) },
        { role: "user", content: userPrompt(snapshot) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq request failed (${res.status}): ${detail.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response.");

  return { text, model, tokenUsage: data.usage?.total_tokens ?? 0 };
}
