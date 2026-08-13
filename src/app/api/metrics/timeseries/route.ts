import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams, timeseries } from "@/lib/metrics/query";

export const runtime = "nodejs";

// GET /api/metrics/timeseries?from&to&property&platform
// Daily series (all base metrics + derived) for charts.
export async function GET(request: Request) {
  try {
    await requireSession();
    const filter = await parseMetricsParams(new URL(request.url).searchParams);
    return NextResponse.json(await timeseries(filter));
  } catch (err) {
    return errorResponse(err);
  }
}
