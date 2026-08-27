import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import {
  listCampaigns,
  setCampaignStatus,
  setCampaignProperty,
  includeCampaignsWithSpend,
  pendingCampaignCount,
  type SpendWindow,
} from "@/lib/campaigns/query";
import type { ReportStatus } from "@/lib/campaigns/constants";

export const runtime = "nodejs";

async function requireCampaignManager() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  if (!canManageCampaigns(asRole(session.user.role)))
    throw new ApiError(403, "Owners and Admins only");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse ?from&to (YYYY-MM-DD) into a spend window; undefined if absent/invalid. */
function parseWindow(from?: string | null, to?: string | null): SpendWindow | undefined {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) return undefined;
  return { from: new Date(`${from}T00:00:00.000Z`), to: new Date(`${to}T00:00:00.000Z`) };
}

// GET /api/campaigns[?from&to] — all campaigns with status + spend over the
// window (default last 30 days), plus the pending count.
export async function GET(request: Request) {
  try {
    await requireCampaignManager();
    const sp = new URL(request.url).searchParams;
    const window = parseWindow(sp.get("from"), sp.get("to"));
    const [campaigns, pendingCount] = await Promise.all([
      listCampaigns(window),
      pendingCampaignCount(),
    ]);
    return NextResponse.json({ campaigns, pendingCount });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/campaigns
//   { id, status }                          → set a campaign's report status
//   { id, propertyCode }                    → reassign its unit
//   { action: "include-with-spend", from, to } → turn on every campaign that
//                                                 spent in the window
export async function PATCH(request: Request) {
  try {
    await requireCampaignManager();
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      status?: string;
      propertyCode?: string;
      action?: string;
      from?: string;
      to?: string;
    } | null;

    if (body?.action === "include-with-spend") {
      const window = parseWindow(body.from, body.to);
      if (!window) throw new ApiError(400, "from and to (YYYY-MM-DD) are required");
      const result = await includeCampaignsWithSpend(window.from, window.to);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!body?.id) throw new ApiError(400, "id is required");
    if (body.propertyCode) {
      await setCampaignProperty(body.id, body.propertyCode);
    } else if (body.status) {
      await setCampaignStatus(body.id, body.status as ReportStatus);
    } else {
      throw new ApiError(400, "status or propertyCode is required");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
