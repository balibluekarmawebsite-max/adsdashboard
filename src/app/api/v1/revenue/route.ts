import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/key";
import { errorResponse } from "@/lib/api/errors";
import { listRevenue, listRevenuePeriods } from "@/lib/revenue/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/revenue — every revenue entry (monthly + date-range), each with its
// property, ad spend for that period, and ROAS. API-key protected.
export async function GET(request: Request) {
  try {
    requireApiKey(request);
    const [monthly, periods] = await Promise.all([listRevenue(), listRevenuePeriods()]);
    return NextResponse.json({ generatedAt: new Date().toISOString(), monthly, periods });
  } catch (err) {
    return errorResponse(err);
  }
}
