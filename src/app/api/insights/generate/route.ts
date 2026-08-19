import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams } from "@/lib/metrics/query";
import { getInsight } from "@/lib/ai/insights";
import { isLanguage } from "@/lib/ai/prompt";

export const runtime = "nodejs";

// POST /api/insights/generate?from&to&property&platform&lang
// Forces a fresh generation (the "Regenerate" button), bypassing the cache.
export async function POST(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const filter = await parseMetricsParams(url.searchParams);
    const langParam = url.searchParams.get("lang");
    const language = isLanguage(langParam) ? langParam : "en";
    return NextResponse.json(await getInsight(filter, language, { force: true }));
  } catch (err) {
    return errorResponse(err);
  }
}
