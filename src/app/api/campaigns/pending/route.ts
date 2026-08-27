import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import { pendingCampaignCount } from "@/lib/campaigns/query";

export const runtime = "nodejs";

// GET /api/campaigns/pending — how many new campaigns await review (0 for
// non-managers, so the notice only shows to Owners/Admins).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "Unauthorized");
    const count = canManageCampaigns(asRole(session.user.role)) ? await pendingCampaignCount() : 0;
    return NextResponse.json({ count });
  } catch (err) {
    return errorResponse(err);
  }
}
