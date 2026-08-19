// Phase 9/10 — the Groq client. Groq exposes an OpenAI-compatible endpoint, so
// we call it with plain fetch (no extra dependency). The API key is read from
// the environment and NEVER leaves the server.

import { systemPrompt, userPrompt, type InsightLanguage } from "./prompt";
import type { InsightSnapshot } from "./snapshot";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
// Vision-capable default for reading screenshots; override via GROQ_VISION_MODEL.
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/** Model is a config value, not hardcoded — Groq's lineup changes often. */
export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

export function getGroqVisionModel(): string {
  return process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL;
}

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface GroqChatResult {
  text: string;
  model: string;
  tokenUsage: number;
}

/** Low-level chat call. Throws on any failure so callers can handle fallback. */
export async function groqChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; responseFormatJson?: boolean } = {},
): Promise<GroqChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — add it to .env to enable AI features.");
  const model = opts.model || getGroqModel();

  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature ?? 0.2,
    messages,
  };
  if (opts.responseFormatJson) body.response_format = { type: "json_object" };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
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

export interface GeneratedSummary {
  text: string;
  model: string;
  tokenUsage: number;
}

/** Ask Groq to phrase a pre-computed snapshot in the requested language. */
export async function generateSummary(
  snapshot: InsightSnapshot,
  language: InsightLanguage,
): Promise<GeneratedSummary> {
  return groqChat(
    [
      { role: "system", content: systemPrompt(language) },
      { role: "user", content: userPrompt(snapshot) },
    ],
    { temperature: 0.2 },
  );
}
