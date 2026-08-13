import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/guard";
import { errorResponse } from "@/lib/api/errors";
import { parseMetricsParams, byProperty } from "@/lib/metrics/query";

export const runtime = "nodejs";

// GET /api/metrics/by-property?from&to&platform — compare properties.
export async function GET(request: Request) {
  try {
    await requireSession();
    const filter = await parseMetricsParams(new URL(request.url).searchParams);
    return NextResponse.json(await byProperty(filter));
  } catch (err) {
    return errorResponse(err);
  }
}
