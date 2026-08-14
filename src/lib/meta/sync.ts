import { prisma } from "@/lib/db";
import { runAccountSync } from "@/lib/sync/metrics";
import { rollingWindow } from "@/lib/sync/dates";
import type { AccountSyncResult } from "@/lib/sync/types";
import { loadRoutes, applyRoutes } from "@/lib/sync/routing";
import { fetchDailyMetrics } from "./connector";

const DEFAULT_DAYS = Number(process.env.SYNC_ROLLING_DAYS ?? 21);

export interface MetaSyncSummary {
  platform: "meta";
  start: string;
  end: string;
  accounts: number;
  results: AccountSyncResult[];
}

/** Pull the rolling window for every Meta ad account, one account at a time. */
export async function syncAllMeta(days: number = DEFAULT_DAYS): Promise<MetaSyncSummary> {
  const accounts = await prisma.adAccount.findMany({ where: { platform: "meta" } });
  const { start, end } = rollingWindow(days);

  const results: AccountSyncResult[] = [];
  for (const account of accounts) {
    const routes = await loadRoutes(account.id);
    const res = await runAccountSync({
      platform: "meta",
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

  return { platform: "meta", start, end, accounts: accounts.length, results };
}
