import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import type { ReportStatus } from "./constants";

export interface CampaignRow {
  id: string;
  platform: string;
  externalId: string;
  name: string;
  propertyCode: string | null;
  propertyName: string | null;
  status: ReportStatus;
  spend: number; // spend over the selected window, to aid include/exclude decisions
  lastSeenAt: string;
}

/** Spend window for the campaigns list; defaults to the last 30 days. */
export interface SpendWindow {
  from: Date;
  to: Date;
}

/**
 * The campaign filter for the owner report: the external ids of `included`
 * campaigns. Returns `null` when the registry isn't populated yet (so the
 * dashboard shows everything until campaigns have been discovered).
 */
export async function includedCampaignFilter(): Promise<string[] | null> {
  const total = await prisma.campaign.count();
  if (total === 0) return null;
  const included = await prisma.campaign.findMany({
    where: { status: "included" },
    select: { externalId: true },
  });
  return included.map((c) => c.externalId);
}

export async function pendingCampaignCount(): Promise<number> {
  return prisma.campaign.count({ where: { status: "pending" } });
}

/**
 * All campaigns with their property, status, and spend over `window` (defaults
 * to the last 30 days). Pass a month's range to see which campaigns actually
 * spent that month, to decide what belongs on the report.
 */
export async function listCampaigns(window?: SpendWindow): Promise<CampaignRow[]> {
  const campaigns = await prisma.campaign.findMany({
    include: { property: { select: { code: true, name: true } } },
    orderBy: [{ status: "asc" }, { property: { code: "asc" } }, { name: "asc" }],
  });

  let from: Date;
  let to: Date | undefined;
  if (window) {
    from = window.from;
    to = window.to;
  } else {
    from = new Date();
    from.setUTCDate(from.getUTCDate() - 29);
  }

  const spendGroups = await prisma.metricsDaily.groupBy({
    by: ["campaignId"],
    where: { date: { gte: from, ...(to ? { lte: to } : {}) } },
    _sum: { spend: true },
  });
  const spendByCampaign = new Map(spendGroups.map((g) => [g.campaignId, Number(g._sum.spend ?? 0)]));

  return campaigns.map((c) => ({
    id: c.id,
    platform: c.platform,
    externalId: c.externalId,
    name: c.name,
    propertyCode: c.property?.code ?? null,
    propertyName: c.property?.name ?? null,
    status: c.status as ReportStatus,
    spend: spendByCampaign.get(c.externalId) ?? 0,
    lastSeenAt: c.lastSeenAt.toISOString(),
  }));
}

/**
 * Turn ON (include on the report) every campaign that had spend in [from, to].
 * Additive — campaigns already on the report stay on; nothing is turned off.
 * Returns how many were newly switched on and how many spent in total.
 */
export async function includeCampaignsWithSpend(
  from: Date,
  to: Date,
): Promise<{ updated: number; matched: number }> {
  const groups = await prisma.metricsDaily.groupBy({
    by: ["campaignId"],
    where: { date: { gte: from, lte: to } },
    _sum: { spend: true },
  });
  const spentIds = groups.filter((g) => Number(g._sum.spend ?? 0) > 0).map((g) => g.campaignId);
  if (spentIds.length === 0) return { updated: 0, matched: 0 };

  const [res, matched] = await Promise.all([
    prisma.campaign.updateMany({
      where: { externalId: { in: spentIds }, status: { not: "included" } },
      data: { status: "included" },
    }),
    prisma.campaign.count({ where: { externalId: { in: spentIds } } }),
  ]);
  return { updated: res.count, matched };
}

export async function setCampaignStatus(id: string, status: ReportStatus): Promise<void> {
  if (status !== "pending" && status !== "included" && status !== "excluded") {
    throw new ApiError(400, "Invalid status");
  }
  try {
    await prisma.campaign.update({ where: { id }, data: { status } });
  } catch {
    throw new ApiError(404, "Campaign not found");
  }
}

/**
 * Manually assign a campaign to a property (unit). Locks it so the auto-router
 * won't override it, and re-attributes the campaign's existing metrics to the
 * chosen property immediately so the report reflects it at once.
 */
export async function setCampaignProperty(id: string, propertyCode: string): Promise<void> {
  const property = await prisma.property.findUnique({ where: { code: propertyCode } });
  if (!property) throw new ApiError(400, `Unknown property "${propertyCode}"`);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new ApiError(404, "Campaign not found");

  await prisma.campaign.update({
    where: { id },
    data: { propertyId: property.id, locked: true },
  });
  await prisma.metricsDaily.updateMany({
    where: {
      platform: campaign.platform,
      adAccountId: campaign.adAccountId,
      campaignId: campaign.externalId,
    },
    data: { propertyId: property.id },
  });
}
