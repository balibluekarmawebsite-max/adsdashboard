import { prisma } from "@/lib/db";
import { toDateColumn } from "./dates";
import type { NormalizedMetricRow, PlatformName } from "./types";

/**
 * Upsert a normalized row on the unique key (date, platform, adAccountId,
 * campaignId). Re-syncing the same day UPDATES instead of duplicating.
 */
export async function upsertMetricRow(row: NormalizedMetricRow): Promise<void> {
  const date = toDateColumn(row.date);
  const values = {
    propertyId: row.propertyId, // updatable, so re-syncing applies routing changes
    campaignName: row.campaignName,
    impressions: Math.round(row.impressions),
    reach: Math.round(row.reach),
    clicks: Math.round(row.clicks),
    spend: row.spend,
    conversions: row.conversions,
    conversionValue: row.conversionValue,
    currency: row.currency,
  };

  await prisma.metricsDaily.upsert({
    where: {
      date_platform_adAccountId_campaignId: {
        date,
        platform: row.platform,
        adAccountId: row.adAccountId,
        campaignId: row.campaignId,
      },
    },
    create: {
      date,
      platform: row.platform,
      adAccountId: row.adAccountId,
      campaignId: row.campaignId,
      ...values,
    },
    update: values,
  });
}

/**
 * Run one account's sync inside a syncLog record, resilient by design: throwing
 * is caught and logged so the caller can continue with other accounts.
 */
export async function runAccountSync(opts: {
  platform: PlatformName;
  adAccountId: string;
  externalAccountId: string;
  fetch: () => Promise<NormalizedMetricRow[]>;
}): Promise<{ ok: boolean; rowsWritten: number; error?: string }> {
  const log = await prisma.syncLog.create({
    data: { platform: opts.platform, adAccountId: opts.adAccountId, status: "running" },
  });

  try {
    const rows = await opts.fetch();
    for (const row of rows) {
      await upsertMetricRow(row);
    }
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", finishedAt: new Date(), rowsWritten: rows.length },
    });
    return { ok: true, rowsWritten: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "error", finishedAt: new Date(), errorMessage: message.slice(0, 1000) },
    });
    return { ok: false, rowsWritten: 0, error: message };
  }
}
