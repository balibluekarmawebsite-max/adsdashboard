// Restaurant & spa outlets that sit UNDER a hotel (Phase 12). Each outlet shares
// its hotel's ad account, so campaigns are split out by name. This file is the
// single source of truth for the outlet list and is client-safe (no prisma
// import), so both the seed script and the UI can use it.

export type OutletKind = "restaurant" | "spa";

export interface OutletDef {
  /** Property code, e.g. "BKDU-RES". */
  code: string;
  /** Parent hotel's property code, e.g. "BKDU". */
  parentCode: string;
  kind: OutletKind;
  /** Display name, e.g. "Botanist". */
  name: string;
  /**
   * Lower-case substrings that identify this outlet in a campaign name. Kept
   * distinctive so auto-routing never mistakes one outlet for another.
   */
  keywords: string[];
}

export const OUTLETS: OutletDef[] = [
  // Blue Karma Dijiwa Ubud
  { code: "BKDU-RES", parentCode: "BKDU", kind: "restaurant", name: "Botanist", keywords: ["botanist"] },
  {
    code: "BKDU-SPA",
    parentCode: "BKDU",
    kind: "spa",
    name: "Flying Bamboo Spa",
    keywords: ["flying bamboo", "bamboo spa"],
  },
  // Blue Karma Dijiwa Seminyak
  { code: "BKDS-RES", parentCode: "BKDS", kind: "restaurant", name: "Bketo", keywords: ["bketo"] },
  { code: "BKDS-SPA", parentCode: "BKDS", kind: "spa", name: "Mudara Spa", keywords: ["mudara"] },
  // Blue Karma Village
  { code: "BKV-RES", parentCode: "BKV", kind: "restaurant", name: "Hiiragi", keywords: ["hiiragi"] },
  { code: "BKV-SPA", parentCode: "BKV", kind: "spa", name: "Heiwa Spa", keywords: ["heiwa"] },
];

const OUTLET_BY_CODE = new Map(OUTLETS.map((o) => [o.code, o]));

export function isOutletCode(code: string): boolean {
  return OUTLET_BY_CODE.has(code);
}

/**
 * The outlet a campaign name belongs to, by keyword match — or null when it
 * looks like a hotel campaign. Used to auto-route new outlet campaigns; a manual
 * assignment always overrides this.
 */
export function matchOutlet(campaignName: string): OutletDef | null {
  const name = (campaignName ?? "").toLowerCase();
  for (const outlet of OUTLETS) {
    if (outlet.keywords.some((kw) => name.includes(kw))) return outlet;
  }
  return null;
}
