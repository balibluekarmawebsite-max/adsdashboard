// Reporting timezone kept consistent across sync + queries (Bali = UTC+8).
export const REPORTING_TIMEZONE = process.env.SYNC_TIMEZONE ?? "Asia/Makassar";

/** Format a Date as YYYY-MM-DD in the reporting timezone. */
export function toReportingDateString(date: Date, timeZone = REPORTING_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * A rolling window ending "today" (in the reporting timezone), inclusive.
 * Re-pulling recent days lets late-attributed conversions get corrected via upsert.
 */
export function rollingWindow(days: number, now = new Date()): { start: string; end: string } {
  const endStr = toReportingDateString(now);
  const end = new Date(`${endStr}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: endStr };
}

/** Parse a YYYY-MM-DD string into a UTC-midnight Date for the DATE column. */
export function toDateColumn(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * A sync's date window: an explicit start/end (YYYY-MM-DD) to backfill a
 * specific period, or a rolling day count. When start+end are given they win;
 * otherwise a rolling window of `days` (or the caller's default) is used.
 */
export interface SyncWindow {
  start?: string;
  end?: string;
  days?: number;
}

export function resolveWindow(
  opt: SyncWindow | undefined,
  defaultDays: number,
): { start: string; end: string } {
  if (opt?.start && opt?.end) {
    return opt.start <= opt.end
      ? { start: opt.start, end: opt.end }
      : { start: opt.end, end: opt.start };
  }
  return rollingWindow(opt?.days ?? defaultDays);
}
