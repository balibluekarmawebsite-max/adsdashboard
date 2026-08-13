import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams, byPlatform } from "@/lib/metrics/query";

export const runtime = "nodejs";

// GET /api/metrics/by-platform?from&to&property — Google vs Meta breakdown.
export async function GET(request: Request) {
  try {
    await requireSession();
    const filter = await parseMetricsParams(new URL(request.url).searchParams);
    return NextResponse.json(await byPlatform(filter));
  } catch (err) {
    return errorResponse(err);
  }
}
