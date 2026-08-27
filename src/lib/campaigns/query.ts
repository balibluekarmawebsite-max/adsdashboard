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
  spend30d: number; // recent spend, to aid include/exclude decisions
  lastSeenAt: string;
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

/** All campaigns with their property, status, and recent (30-day) spend. */
export async function listCampaigns(): Promise<CampaignRow[]> {
  const campaigns = await prisma.campaign.findMany({
    include: { property: { select: { code: true, name: true } } },
    orderBy: [{ status: "asc" }, { property: { code: "asc" } }, { name: "asc" }],
  });

  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  const spendGroups = await prisma.metricsDaily.groupBy({
    by: ["campaignId"],
    where: { date: { gte: from } },
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
    spend30d: spendByCampaign.get(c.externalId) ?? 0,
    lastSeenAt: c.lastSeenAt.toISOString(),
  }));
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
