// Client-safe property helpers (NO prisma import — safe to use in UI). Hotels
// are top-level; restaurant/spa outlets hang under a hotel and are grouped
// beneath it in every property picker.

export interface PropertyOption {
  code: string;
  name: string;
  kind: string; // "hotel" | "restaurant" | "spa"
  parentCode: string | null; // null for hotels; the hotel's code for outlets
}

export interface PropertyGroup {
  hotel: PropertyOption;
  outlets: PropertyOption[];
}

const byCode = (a: PropertyOption, b: PropertyOption) => a.code.localeCompare(b.code);

/** Group properties as hotels, each with its restaurant/spa outlets beneath. */
export function groupByHotel(properties: PropertyOption[]): PropertyGroup[] {
  const hotels = properties.filter((p) => p.parentCode == null).sort(byCode);
  const outletsByParent = new Map<string, PropertyOption[]>();
  for (const p of properties) {
    if (p.parentCode == null) continue;
    const list = outletsByParent.get(p.parentCode) ?? [];
    list.push(p);
    outletsByParent.set(p.parentCode, list);
  }

  const groups = hotels.map((hotel) => ({
    hotel,
    outlets: (outletsByParent.get(hotel.code) ?? []).sort(byCode),
  }));

  // Never hide an outlet whose parent is missing from the list — surface it as
  // its own group rather than dropping it.
  const hotelCodes = new Set(hotels.map((h) => h.code));
  for (const [parentCode, list] of outletsByParent) {
    if (!hotelCodes.has(parentCode)) {
      for (const orphan of list.sort(byCode)) groups.push({ hotel: orphan, outlets: [] });
    }
  }
  return groups;
}

const KIND_LABEL: Record<string, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  spa: "Spa",
  wellness: "Wellness",
};

export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;
