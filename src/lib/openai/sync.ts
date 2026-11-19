import { prisma } from "@/lib/db";
import { runAccountSync } from "@/lib/sync/metrics";
import { resolveWindow, type SyncWindow } from "@/lib/sync/dates";
import type { AccountSyncResult } from "@/lib/sync/types";
import { loadRoutes, applyRoutes } from "@/lib/sync/routing";
import { refreshCampaignRegistry } from "@/lib/campaigns/registry";
import { fetchDailyMetrics } from "./connector";

const DEFAULT_DAYS = Number(process.env.SYNC_ROLLING_DAYS ?? 21);

export interface OpenAiSyncSummary {
  platform: "openai";
  start: string;
  end: string;
  accounts: number;
  results: AccountSyncResult[];
}

/**
 * Pull metrics for every OpenAI (ChatGPT) ad account, one account at a time.
 * Pass a `{ start, end }` window to backfill a specific period; otherwise the
 * rolling default window is used. Mirrors syncAllGoogle / syncAllMeta.
 */
export async function syncAllOpenai(opt?: SyncWindow): Promise<OpenAiSyncSummary> {
  const accounts = await prisma.adAccount.findMany({ where: { platform: "openai" } });
  const { start, end } = resolveWindow(opt, DEFAULT_DAYS);

  const results: AccountSyncResult[] = [];
  for (const account of accounts) {
    const routes = await loadRoutes(account.id);
    const res = await runAccountSync({
      platform: "openai",
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

  return { platform: "openai", start, end, accounts: accounts.length, results };
}
