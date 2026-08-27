import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import {
  listCampaigns,
  setCampaignStatus,
  setCampaignProperty,
  pendingCampaignCount,
} from "@/lib/campaigns/query";
import type { ReportStatus } from "@/lib/campaigns/constants";

export const runtime = "nodejs";

async function requireCampaignManager() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  if (!canManageCampaigns(asRole(session.user.role)))
    throw new ApiError(403, "Owners and Admins only");
}

// GET /api/campaigns — all campaigns with status + recent spend, plus the pending count.
export async function GET() {
  try {
    await requireCampaignManager();
    const [campaigns, pendingCount] = await Promise.all([listCampaigns(), pendingCampaignCount()]);
    return NextResponse.json({ campaigns, pendingCount });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/campaigns — set a campaign's report status, or reassign its property.
export async function PATCH(request: Request) {
  try {
    await requireCampaignManager();
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      status?: string;
      propertyCode?: string;
    } | null;
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
