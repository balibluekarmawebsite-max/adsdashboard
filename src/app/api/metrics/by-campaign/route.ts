import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams, byCampaign } from "@/lib/metrics/query";

export const runtime = "nodejs";

// GET /api/metrics/by-campaign?from&to&property&platform&limit
// Per-campaign rows (sorted by spend desc); the client can re-sort.
export async function GET(request: Request) {
  try {
    await requireSession();
    const sp = new URL(request.url).searchParams;
    const filter = await parseMetricsParams(sp);
    // Missing/blank limit → default 500 (note Number(null) === 0, not NaN).
    const rawLimit = sp.get("limit");
    const parsedLimit = rawLimit != null && rawLimit !== "" ? Number(rawLimit) : NaN;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 1000) : 500;
    return NextResponse.json(await byCampaign(filter, limit));
  } catch (err) {
    return errorResponse(err);
  }
}
