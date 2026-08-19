// Client-safe revenue constants and types — no server-only imports, so both the
// UI and the server can use them. (query.ts adds the Prisma-backed functions.)

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}
