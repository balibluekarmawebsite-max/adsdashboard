import { prisma } from "@/lib/db";

// The campaign registry: which campaigns exist and whether they appear on the
// owner report. Populated from the metrics we've already synced.

export interface RegistryRefreshResult {
  scanned: number;
  added: number;
  pending: number;
  total: number;
  grandfathered: boolean;
}

/**
 * Keep the registry in sync with the campaigns present in metrics.
 *
 * On the FIRST run (empty registry) every existing campaign is grandfathered as
 * `included`, so the current report is unchanged. After that, genuinely new
 * campaigns arrive as `pending` — excluded from the report until reviewed.
 */
export async function refreshCampaignRegistry(): Promise<RegistryRefreshResult> {
  const existing = await prisma.campaign.count();
  const grandfather = existing === 0;

  const groups = await prisma.metricsDaily.groupBy({
    by: ["platform", "adAccountId", "campaignId", "campaignName", "propertyId"],
  });

  let added = 0;
  for (const g of groups) {
    const found = await prisma.campaign.findUnique({
      where: {
        platform_adAccountId_externalId: {
          platform: g.platform,
          adAccountId: g.adAccountId,
          externalId: g.campaignId,
        },
      },
      select: { id: true },
    });

    if (found) {
      // Keep the name / property fresh; @updatedAt bumps lastSeenAt.
      await prisma.campaign.update({
        where: { id: found.id },
        data: { name: g.campaignName, propertyId: g.propertyId },
      });
    } else {
      await prisma.campaign.create({
        data: {
          platform: g.platform,
          adAccountId: g.adAccountId,
          externalId: g.campaignId,
          name: g.campaignName,
          propertyId: g.propertyId,
          status: grandfather ? "included" : "pending",
        },
      });
      added++;
    }
  }

  const [pending, total] = await Promise.all([
    prisma.campaign.count({ where: { status: "pending" } }),
    prisma.campaign.count(),
  ]);
  return { scanned: groups.length, added, pending, total, grandfathered: grandfather };
}
