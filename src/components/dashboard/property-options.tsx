"use client";

import { groupByHotel, kindLabel, type PropertyOption } from "@/lib/properties";

/**
 * `<option>`/`<optgroup>` list for a property `<select>` — hotels with their
 * restaurant/spa outlets grouped beneath. The value is always the property
 * `code`. Drop it inside a `<select>` (optionally after an "All" option).
 */
export function PropertyOptions({ properties }: { properties: PropertyOption[] }) {
  return (
    <>
      {groupByHotel(properties).map(({ hotel, outlets }) =>
        outlets.length === 0 ? (
          <option key={hotel.code} value={hotel.code}>
            {hotel.code}
          </option>
        ) : (
          <optgroup key={hotel.code} label={hotel.name}>
            <option value={hotel.code}>{hotel.code} · Hotel</option>
            {outlets.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name} · {kindLabel(o.kind)}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </>
  );
}
