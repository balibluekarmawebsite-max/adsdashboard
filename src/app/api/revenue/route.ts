import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/api/guard";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { asRole, canManageRevenue } from "@/lib/rbac";
import {
  listRevenue,
  upsertRevenue,
  deleteRevenue,
  parseRevenueInput,
  listRevenuePeriods,
  upsertRevenuePeriod,
  deleteRevenuePeriod,
  parseRevenuePeriodInput,
} from "@/lib/revenue/query";

export const runtime = "nodejs";

/** Writes (enter/edit/delete revenue) are Owner/Admin only. */
async function requireRevenueManager() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  if (!canManageRevenue(asRole(session.user.role))) throw new ApiError(403, "Owners and Admins only");
  return session;
}

// GET /api/revenue — monthly revenue history plus date-range (period) entries,
// each with ad spend + ROAS.
export async function GET() {
  try {
    await requireSession();
    const [rows, periods] = await Promise.all([listRevenue(), listRevenuePeriods()]);
    return NextResponse.json({ rows, periods });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/revenue — create or overwrite revenue. A body with startDate/endDate
// is a date-range entry; otherwise it's a calendar-month entry.
export async function POST(request: Request) {
  try {
    await requireRevenueManager();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && (body.startDate != null || body.endDate != null || body.kind === "period")) {
      const row = await upsertRevenuePeriod(parseRevenuePeriodInput(body));
      return NextResponse.json({ id: row.id });
    }
    const row = await upsertRevenue(parseRevenueInput(body));
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/revenue?id=... (month) or ?periodId=... (date range).
export async function DELETE(request: Request) {
  try {
    await requireRevenueManager();
    const params = new URL(request.url).searchParams;
    const periodId = params.get("periodId");
    if (periodId) {
      await deleteRevenuePeriod(periodId);
      return NextResponse.json({ ok: true });
    }
    const id = params.get("id");
    if (!id) throw new ApiError(400, "id or periodId is required");
    await deleteRevenue(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
