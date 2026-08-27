import cron from "node-cron";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";

let started = false;

/**
 * In-process daily sync (node-cron). Runs both connectors on a rolling window.
 *
 * Note: in-process cron only runs while the app is up; if the process restarts
 * mid-day it won't "catch up". For more robustness, disable this (CRON_ENABLED=
 * false) and drive `npm run sync:all` from a host cron, or move to BullMQ+Redis.
 */
export function startScheduler(): void {
  if (started) return;
  if (process.env.CRON_ENABLED === "false") {
    console.log("[cron] disabled (CRON_ENABLED=false)");
    return;
  }

  const expr = process.env.SYNC_CRON ?? "30 2 * * *";
  const timezone = process.env.SYNC_TIMEZONE ?? "Asia/Makassar";
  const days = Number(process.env.SYNC_ROLLING_DAYS ?? 21);

  if (!cron.validate(expr)) {
    console.error(`[cron] invalid SYNC_CRON "${expr}" — scheduler not started`);
    return;
  }

  cron.schedule(
    expr,
    async () => {
      console.log("[cron] daily sync starting");
      try {
        const g = await syncAllGoogle({ days });
        console.log(`[cron] google: ${JSON.stringify(g.results)}`);
      } catch (e) {
        console.error("[cron] google sync failed", e);
      }
      try {
        const m = await syncAllMeta({ days });
        console.log(`[cron] meta: ${JSON.stringify(m.results)}`);
      } catch (e) {
        console.error("[cron] meta sync failed", e);
      }
      console.log("[cron] daily sync finished");
    },
    { timezone, noOverlap: true, name: "daily-ads-sync" },
  );

  started = true;
  console.log(`[cron] daily sync scheduled "${expr}" (${timezone}), rolling ${days} days`);
}
