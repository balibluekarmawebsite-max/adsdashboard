import { prisma } from "@/lib/db";

// Revenue is stored per calendar month, but the dashboard filters by arbitrary
// day ranges (7d / 30d / MTD / custom). We allocate each month's revenue to a
// range by the share of that month's days the range covers — so ROAS
// (revenue ÷ spend) is well-defined for any range, not just whole months.

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
  const rows = await prisma.revenueMonthly.findMany({
    where,
    select: { year: true, month: true, amount: true },
  });

  const fromT = utcDay(from);
  const toT = utcDay(to);
  let total = 0;

  for (const r of rows) {
    const monthStart = Date.UTC(r.year, r.month - 1, 1);
    const monthEnd = Date.UTC(r.year, r.month, 0); // last day of the month
    const daysInMonth = (monthEnd - monthStart) / DAY + 1;

    const overlapStart = Math.max(fromT, monthStart);
    const overlapEnd = Math.min(toT, monthEnd);
    if (overlapEnd < overlapStart) continue;

    const overlapDays = (overlapEnd - overlapStart) / DAY + 1;
    total += Number(r.amount) * (overlapDays / daysInMonth);
  }

  return total;
}
