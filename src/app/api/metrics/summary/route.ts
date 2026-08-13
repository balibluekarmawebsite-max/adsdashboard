import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams, summary } from "@/lib/metrics/query";

export const runtime = "nodejs";

// GET /api/metrics/summary?from&to&property&platform
// Totals + derived KPIs + % change vs the previous equal-length period.
export async function GET(request: Request) {
  try {
    await requireSession();
    const filter = await parseMetricsParams(new URL(request.url).searchParams);
    return NextResponse.json(await summary(filter));
  } catch (err) {
    return errorResponse(err);
  }
}
