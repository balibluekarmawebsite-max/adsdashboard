import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/api/guard";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { asRole, canManageRevenue } from "@/lib/rbac";
import { listRevenue, upsertRevenue, deleteRevenue, parseRevenueInput } from "@/lib/revenue/query";

export const runtime = "nodejs";

/** Writes (enter/edit/delete revenue) are Owner/Admin only. */
async function requireRevenueManager() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  if (!canManageRevenue(asRole(session.user.role))) throw new ApiError(403, "Owners and Admins only");
  return session;
}

// GET /api/revenue — full monthly revenue history (with ad spend + ROAS per row).
export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ rows: await listRevenue() });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/revenue — create or overwrite one property-month's revenue.
export async function POST(request: Request) {
  try {
    await requireRevenueManager();
    const input = parseRevenueInput(await request.json().catch(() => null));
    const row = await upsertRevenue(input);
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/revenue?id=... — remove one revenue row.
export async function DELETE(request: Request) {
  try {
    await requireRevenueManager();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new ApiError(400, "id is required");
    await deleteRevenue(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
