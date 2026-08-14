import { prisma } from "@/lib/db";

// Campaign → property routing. Lets a single ad account feed several properties,
// split by campaign name (e.g. campaigns prefixed BKDU / BKV / BKDS).

export interface RouteRule {
  pattern: string;
  isRegex: boolean;
  propertyId: string;
  priority: number;
}

/** Load an ad account's campaign routes, highest priority first. */
export async function loadRoutes(adAccountId: string): Promise<RouteRule[]> {
  return prisma.campaignRoute.findMany({
    where: { adAccountId },
    orderBy: { priority: "desc" },
    select: { pattern: true, isRegex: true, propertyId: true, priority: true },
  });
}

/**
 * Pick the property for a campaign by name. The highest-priority matching route
 * wins; returns null when nothing matches (the caller drops those rows).
 * Substring matches are case-insensitive; regex routes compile case-insensitive.
 */
export function resolvePropertyId(campaignName: string, routes: RouteRule[]): string | null {
  const name = campaignName ?? "";
  let best: RouteRule | null = null;
  for (const r of routes) {
    let matched = false;
    if (r.isRegex) {
      try {
        matched = new RegExp(r.pattern, "i").test(name);
      } catch {
        matched = false; // a bad regex never matches (and never throws the sync)
      }
    } else {
      matched = name.toLowerCase().includes(r.pattern.toLowerCase());
    }
    if (matched && (best === null || r.priority > best.priority)) best = r;
  }
  return best ? best.propertyId : null;
}

/**
 * Route normalized rows to properties. With NO routes (a dedicated account),
 * rows pass through unchanged (they already carry the account's property). With
 * routes, each row is re-assigned to its matching property and campaigns that
 * match nothing are DROPPED.
 */
export function applyRoutes<T extends { campaignName: string; propertyId: string }>(
  rows: T[],
  routes: RouteRule[],
): T[] {
  if (routes.length === 0) return rows;
  const out: T[] = [];
  for (const row of rows) {
    const propertyId = resolvePropertyId(row.campaignName, routes);
    if (propertyId) out.push({ ...row, propertyId });
  }
  return out;
}
