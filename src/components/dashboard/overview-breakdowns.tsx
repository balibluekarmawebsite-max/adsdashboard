"use client";

import { useFilters } from "@/components/providers/filters-provider";
import { cn } from "@/lib/utils";
import { PlatformSplit } from "./platform-split";
import { PropertyComparison } from "./property-comparison";

/**
 * The Google-vs-Meta and Properties-by-spend cards. "Properties by spend" only
 * makes sense across the whole group, so it shows on the "All hotels" view and
 * is hidden when a single hotel or outlet is selected (Google vs Meta then takes
 * the full width).
 */
export function OverviewBreakdowns() {
  const { property } = useFilters();
  const isAll = property === "all";

  return (
    <div className={cn("grid gap-6", isAll && "lg:grid-cols-2")}>
      <PlatformSplit />
      {isAll && <PropertyComparison />}
    </div>
  );
}
