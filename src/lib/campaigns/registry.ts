import { prisma } from "@/lib/db";
import { matchOutlet } from "./outlets";

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
      select: { id: true, locked: true },
    });

    if (found) {
      // Keep the name fresh; only re-derive the property when NOT manually
      // locked (a manual assignment must survive the sync).
      await prisma.campaign.update({
        where: { id: found.id },
        data: found.locked
          ? { name: g.campaignName }
          : { name: g.campaignName, propertyId: g.propertyId },
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

  // Auto-route outlet campaigns (Botanist → BKDU-RES, Bketo → BKDS-RES, …) by
  // name, so restaurant/spa spend lands on the outlet's own report instead of
  // the hotel. Only UNLOCKED campaigns are touched — a manual unit assignment
  // always wins — and a match locks the campaign so it stays put.
  await autoRouteOutlets();

  // Re-apply manual property assignments: routing may have re-attributed a
  // locked campaign's fresh rows, so point them back at the chosen property.
  const locked = await prisma.campaign.findMany({
    where: { locked: true, propertyId: { not: null } },
    select: { platform: true, adAccountId: true, externalId: true, propertyId: true },
  });
  for (const c of locked) {
    if (!c.propertyId) continue;
    await prisma.metricsDaily.updateMany({
      where: {
        platform: c.platform,
        adAccountId: c.adAccountId,
        campaignId: c.externalId,
        propertyId: { not: c.propertyId },
      },
      data: { propertyId: c.propertyId },
    });
  }

  const [pending, total] = await Promise.all([
    prisma.campaign.count({ where: { status: "pending" } }),
    prisma.campaign.count(),
  ]);
  return { scanned: groups.length, added, pending, total, grandfathered: grandfather };
}

/**
 * Attribute restaurant/spa campaigns to their outlet by matching the campaign
 * name (see `outlets.ts`). Outlets share the hotel's ad account, so without this
 * their spend would sit under the hotel. Matching locks the campaign to the
 * outlet and pulls its metrics across immediately; already-locked campaigns are
 * left alone so manual fixes are never undone.
 */
async function autoRouteOutlets(): Promise<void> {
  const outlets = await prisma.property.findMany({
    where: { parentId: { not: null } },
    select: { id: true, code: true },
  });
  if (outlets.length === 0) return;
  const idByCode = new Map(outlets.map((o) => [o.code, o.id]));

  const candidates = await prisma.campaign.findMany({
    where: { locked: false },
    select: {
      id: true,
      name: true,
      platform: true,
      adAccountId: true,
      externalId: true,
      propertyId: true,
    },
  });

  for (const c of candidates) {
    const outlet = matchOutlet(c.name);
    if (!outlet) continue;
    const outletId = idByCode.get(outlet.code);
    if (!outletId) continue; // outlet row not seeded yet

    await prisma.campaign.update({
      where: { id: c.id },
      data: { propertyId: outletId, locked: true },
    });
    if (c.propertyId !== outletId) {
      await prisma.metricsDaily.updateMany({
        where: {
          platform: c.platform,
          adAccountId: c.adAccountId,
          campaignId: c.externalId,
        },
        data: { propertyId: outletId },
      });
    }
  }
}
