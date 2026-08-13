import { prisma } from "@/lib/db";
import { runAccountSync } from "@/lib/sync/metrics";
import { rollingWindow } from "@/lib/sync/dates";
import type { AccountSyncResult } from "@/lib/sync/types";
import { fetchDailyMetrics } from "./connector";

const DEFAULT_DAYS = Number(process.env.SYNC_ROLLING_DAYS ?? 21);

export interface GoogleSyncSummary {
  platform: "google";
  start: string;
  end: string;
  accounts: number;
  results: AccountSyncResult[];
}

/** Pull the rolling window for every Google ad account, one account at a time. */
export async function syncAllGoogle(days: number = DEFAULT_DAYS): Promise<GoogleSyncSummary> {
  const accounts = await prisma.adAccount.findMany({ where: { platform: "google" } });
  const { start, end } = rollingWindow(days);

  const results: AccountSyncResult[] = [];
  for (const account of accounts) {
    const res = await runAccountSync({
      platform: "google",
      adAccountId: account.id,
      externalAccountId: account.externalAccountId,
      fetch: () =>
        fetchDailyMetrics(account.externalAccountId, start, end, {
          propertyId: account.propertyId,
          adAccountId: account.id,
          currency: account.currency,
        }),
    });
    results.push({ externalAccountId: account.externalAccountId, ...res });
  }

  return { platform: "google", start, end, accounts: accounts.length, results };
}
