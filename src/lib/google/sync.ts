import { prisma } from "@/lib/db";
import { runAccountSync } from "@/lib/sync/metrics";
import { resolveWindow, type SyncWindow } from "@/lib/sync/dates";
import type { AccountSyncResult } from "@/lib/sync/types";
import { loadRoutes, applyRoutes } from "@/lib/sync/routing";
import { refreshCampaignRegistry } from "@/lib/campaigns/registry";
import { fetchDailyMetrics } from "./connector";

const DEFAULT_DAYS = Number(process.env.SYNC_ROLLING_DAYS ?? 21);

export interface GoogleSyncSummary {
  platform: "google";
  start: string;
  end: string;
  accounts: number;
  results: AccountSyncResult[];
}

/**
 * Pull metrics for every Google ad account, one account at a time. Pass a
 * `{ start, end }` window to backfill a specific period (e.g. a past month);
 * otherwise the rolling default window is used.
 */
export async function syncAllGoogle(opt?: SyncWindow): Promise<GoogleSyncSummary> {
  const accounts = await prisma.adAccount.findMany({ where: { platform: "google" } });
  const { start, end } = resolveWindow(opt, DEFAULT_DAYS);

  const results: AccountSyncResult[] = [];
  for (const account of accounts) {
    const routes = await loadRoutes(account.id);
    const res = await runAccountSync({
      platform: "google",
      adAccountId: account.id,
      externalAccountId: account.externalAccountId,
      fetch: async () => {
        const rows = await fetchDailyMetrics(account.externalAccountId, start, end, {
          propertyId: account.propertyId,
          adAccountId: account.id,
          currency: account.currency,
        });
        return applyRoutes(rows, routes);
      },
    });
    results.push({ externalAccountId: account.externalAccountId, ...res });
  }

  // Keep the campaign registry current (new campaigns land as "pending").
  try {
    await refreshCampaignRegistry();
  } catch (err) {
    console.error("campaign registry refresh failed:", err);
  }

  return { platform: "google", start, end, accounts: accounts.length, results };
}
