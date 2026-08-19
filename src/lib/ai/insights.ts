// Phase 9 — orchestration: cache-or-generate an AI summary for a given view.
//
// Caching is keyed to (filters + a signature of the underlying data), so a
// summary is reused only while both the view AND its data are unchanged; a
// re-sync that changes the numbers produces a fresh one. On a Groq failure we
// fall back to the most recent summary for the same view (flagged stale) so the
// dashboard never breaks.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { MetricsFilter } from "@/lib/metrics/query";
import { buildSnapshot, type InsightSnapshot } from "./snapshot";
import { generateSummary } from "./groq";
import type { InsightLanguage } from "./prompt";

export interface InsightResult {
  summaryText: string | null;
  language: InsightLanguage;
  model: string | null;
  generatedAt: string | null; // ISO
  cached: boolean;
  stale: boolean; // served from an older cache after a failed refresh
  empty: boolean; // no spend in this view — nothing was generated
  error: string | null; // user-facing note when we couldn't refresh
  snapshot: InsightSnapshot; // the key figures, always returned for sanity-checking
}

function hashFilters(filter: MetricsFilter, language: string, dataSignature: string): string {
  const key = [
    filter.fromStr,
    filter.toStr,
    filter.propertyId ?? "all",
    filter.platform ?? "all",
    language,
    dataSignature,
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export async function getInsight(
  filter: MetricsFilter,
  language: InsightLanguage,
  opts: { force?: boolean } = {},
): Promise<InsightResult> {
  const { snapshot, dataSignature, isEmpty } = await buildSnapshot(filter);
  const base = { language, snapshot };

  if (isEmpty) {
    return {
      ...base,
      summaryText: null,
      model: null,
      generatedAt: null,
      cached: false,
      stale: false,
      empty: true,
      error: null,
    };
  }

  const filtersHash = hashFilters(filter, language, dataSignature);
  const property = filter.propertyId ?? "all";
  const platform = filter.platform ?? "all";

  // Serve a matching cached summary unless a fresh one was explicitly requested.
  if (!opts.force) {
    const hit = await prisma.aiSummary.findFirst({
      where: { filtersHash },
      orderBy: { generatedAt: "desc" },
    });
    if (hit) {
      return {
        ...base,
        summaryText: hit.summaryText,
        model: hit.model,
        generatedAt: hit.generatedAt.toISOString(),
        cached: true,
        stale: false,
        empty: false,
        error: null,
      };
    }
  }

  try {
    const gen = await generateSummary(snapshot, language);
    const row = await prisma.aiSummary.create({
      data: {
        filtersHash,
        periodFrom: filter.from,
        periodTo: filter.to,
        property,
        platform,
        language,
        model: gen.model,
        summaryText: gen.text,
        inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        tokenUsage: gen.tokenUsage,
      },
    });
    return {
      ...base,
      summaryText: row.summaryText,
      model: row.model,
      generatedAt: row.generatedAt.toISOString(),
      cached: false,
      stale: false,
      empty: false,
      error: null,
    };
  } catch (err) {
    // Resilience: never break the dashboard — show the last summary for this view.
    const fallback = await prisma.aiSummary.findFirst({
      where: { periodFrom: filter.from, periodTo: filter.to, property, platform, language },
      orderBy: { generatedAt: "desc" },
    });
    if (fallback) {
      return {
        ...base,
        summaryText: fallback.summaryText,
        model: fallback.model,
        generatedAt: fallback.generatedAt.toISOString(),
        cached: true,
        stale: true,
        empty: false,
        error: "Couldn't refresh just now — showing the last summary.",
      };
    }
    return {
      ...base,
      summaryText: null,
      model: null,
      generatedAt: null,
      cached: false,
      stale: false,
      empty: false,
      error: err instanceof Error ? err.message : "Failed to generate summary.",
    };
  }
}
