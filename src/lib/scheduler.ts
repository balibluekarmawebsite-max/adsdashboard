import cron from "node-cron";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";
import { prisma } from "@/lib/db";
import { runSchedule } from "@/lib/reports/scheduled";
import { toReportingDateString } from "@/lib/sync/dates";
import type { ReportSchedule } from "@/generated/prisma/client";

let started = false;

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Hour/minute/weekday/day of `now` in the reporting timezone. */
function reportingParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    hour: Number(get("hour")) % 24, // some locales render midnight as "24"
    minute: Number(get("minute")),
    weekday: WEEKDAY[get("weekday")] ?? 0,
    day: Number(get("day")),
  };
}

function isDue(s: ReportSchedule, now: Date, timeZone: string): boolean {
  if (!s.enabled) return false;
  const p = reportingParts(now, timeZone);
  if (p.hour !== s.hour || p.minute !== s.minute) return false;
  if (s.frequency === "weekly" && s.dayOfWeek != null && p.weekday !== s.dayOfWeek) return false;
  if (s.frequency === "monthly" && s.dayOfMonth != null && p.day !== s.dayOfMonth) return false;
  // Don't send twice in one day (e.g. after a restart within the same minute).
  if (s.lastSentAt && toReportingDateString(s.lastSentAt, timeZone) === toReportingDateString(now, timeZone))
    return false;
  return true;
}

/** Every minute: fire any report/reminder schedule that is due right now. */
function startReportScheduler(timezone: string): void {
  cron.schedule(
    "* * * * *",
    async () => {
      let schedules: ReportSchedule[];
      try {
        schedules = await prisma.reportSchedule.findMany({ where: { enabled: true } });
      } catch {
        return; // table not migrated yet, etc. — stay quiet
      }
      const now = new Date();
      for (const s of schedules) {
        if (!isDue(s, now, timezone)) continue;
        try {
          console.log(`[cron] sending schedule "${s.name}" (${s.kind})`);
          const res = await runSchedule(s);
          if (res.ok) {
            await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
            console.log(`[cron] schedule "${s.name}" sent`);
          } else {
            console.error(`[cron] schedule "${s.name}" failed: ${res.error}`);
          }
        } catch (e) {
          console.error(`[cron] schedule "${s.name}" error`, e);
        }
      }
    },
    { timezone, name: "report-scheduler" },
  );
  console.log("[cron] report scheduler started (minute tick)");
}

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

  startReportScheduler(timezone);

  started = true;
  console.log(`[cron] daily sync scheduled "${expr}" (${timezone}), rolling ${days} days`);
}
