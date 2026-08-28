// Client-safe revenue constants and types — no server-only imports, so both the
// UI and the server can use them. (query.ts adds the Prisma-backed functions.)

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));

/**
 * Compact inclusive date-range label from two "YYYY-MM-DD" strings.
 *   same month:  "21–27 Aug 2026"
 *   same year:   "28 Aug – 3 Sep 2026"
 *   spanning:    "30 Dec 2026 – 2 Jan 2027"
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  if (!y1 || !y2 || !m1 || !m2) return `${startIso} – ${endIso}`;
  const mon1 = SHORT_MONTHS[m1 - 1] ?? String(m1);
  const mon2 = SHORT_MONTHS[m2 - 1] ?? String(m2);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${mon1} ${y1}`;
  if (y1 === y2) return `${d1} ${mon1} – ${d2} ${mon2} ${y1}`;
  return `${d1} ${mon1} ${y1} – ${d2} ${mon2} ${y2}`;
}
