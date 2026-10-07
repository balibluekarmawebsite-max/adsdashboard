import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/key";
import { errorResponse } from "@/lib/api/errors";
import { parseApiFilter, buildReportingPayload } from "@/lib/api/reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/report
//   Auth: Authorization: Bearer <REPORTING_API_KEY>  (or X-API-Key: <key>)
//   Range: ?from=YYYY-MM-DD&to=YYYY-MM-DD  OR  ?period=last-week|this-week|last-7|
//          last-30|this-month|last-month   (default: last-week)
//   Scope: ?property=<code|all>  ?platform=<google|meta|all>
//
// Returns the full dataset for the range: meta, KPI totals (+ % change vs the
// previous period), Google-vs-Meta split, per-property rows (incl. outlets &
// wellness, with revenue), per-campaign rows, and a daily timeseries.
export async function GET(request: Request) {
  try {
    requireApiKey(request);
    const sp = new URL(request.url).searchParams;
    const { filter, scope } = await parseApiFilter(sp);
    return NextResponse.json(await buildReportingPayload(filter, scope));
  } catch (err) {
    return errorResponse(err);
  }
}
