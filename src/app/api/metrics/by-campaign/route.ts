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
    const n = Number(sp.get("limit"));
    const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 1000) : 500;
    return NextResponse.json(await byCampaign(filter, limit));
  } catch (err) {
    return errorResponse(err);
  }
}
