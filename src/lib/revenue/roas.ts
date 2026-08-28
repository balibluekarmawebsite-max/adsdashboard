import { prisma } from "@/lib/db";

// Revenue can be entered two ways:
//   • per calendar month (RevenueMonthly), and
//   • for an explicit date range, e.g. 21–27 Aug (RevenuePeriod).
// The dashboard filters by arbitrary day ranges (7d / 30d / MTD / custom), so we
// resolve revenue for any range like this, per property:
//   1. A date-range entry is the precise figure for the days it covers, so it
//      wins there — prorated by the share of its own days the query overlaps.
//   2. The monthly figure fills only the days NOT already covered by a date-range
//      entry — prorated by the share of that month's days it covers.
// This keeps ROAS (revenue ÷ spend) well-defined for any range and never
// double-counts a day.

const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export async function revenueForRange(
  from: Date,
  to: Date,
  opts?: { propertyId?: string; propertyIds?: string[] },
): Promise<number> {
  // A specific property → just its revenue. A scoped set (a restricted user's
  // allowed properties) → those. Otherwise the blended total, scoped to
  // top-level hotels so outlet revenue isn't folded into the hotel ROAS.
  const where = opts?.propertyId
    ? { propertyId: opts.propertyId }
    : opts?.propertyIds
      ? { propertyId: { in: opts.propertyIds } }
      : { property: { parentId: null } };

  const [monthlyRows, periodRows] = await Promise.all([
    prisma.revenueMonthly.findMany({
      where,
      select: { propertyId: true, year: true, month: true, amount: true },
    }),
    prisma.revenuePeriod.findMany({
      where,
      select: { propertyId: true, startDate: true, endDate: true, amount: true },
    }),
  ]);

  const fromT = utcDay(from);
  const toT = utcDay(to);
  let total = 0;

  // Track, per property, which query days a date-range entry already accounts for,
  // so the monthly figure only fills the gaps.
  const coveredByProperty = new Map<string, Set<number>>();
  const markCovered = (propertyId: string, start: number, end: number) => {
    let days = coveredByProperty.get(propertyId);
    if (!days) {
      days = new Set<number>();
      coveredByProperty.set(propertyId, days);
    }
    for (let d = start; d <= end; d += DAY) days.add(d);
  };

  // 1) Date-range entries take precedence for the days they cover.
  for (const r of periodRows) {
    const periodStart = utcDay(r.startDate);
    const periodEnd = utcDay(r.endDate);
    const periodDays = (periodEnd - periodStart) / DAY + 1;
    if (periodDays <= 0) continue;

    const overlapStart = Math.max(fromT, periodStart);
    const overlapEnd = Math.min(toT, periodEnd);
    if (overlapEnd < overlapStart) continue;

    const overlapDays = (overlapEnd - overlapStart) / DAY + 1;
    total += Number(r.amount) * (overlapDays / periodDays);
    markCovered(r.propertyId, overlapStart, overlapEnd);
  }

  // 2) Monthly figures fill only the days not covered by a date-range entry.
  for (const r of monthlyRows) {
    const monthStart = Date.UTC(r.year, r.month - 1, 1);
    const monthEnd = Date.UTC(r.year, r.month, 0); // last day of the month
    const daysInMonth = (monthEnd - monthStart) / DAY + 1;

    const overlapStart = Math.max(fromT, monthStart);
    const overlapEnd = Math.min(toT, monthEnd);
    if (overlapEnd < overlapStart) continue;

    const covered = coveredByProperty.get(r.propertyId);
    let uncoveredDays = 0;
    for (let d = overlapStart; d <= overlapEnd; d += DAY) {
      if (!covered?.has(d)) uncoveredDays++;
    }
    if (uncoveredDays > 0) total += Number(r.amount) * (uncoveredDays / daysInMonth);
  }

  return total;
}
