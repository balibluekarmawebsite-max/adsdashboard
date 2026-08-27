"use client";

import { useFilters } from "@/components/providers/filters-provider";
import { cn } from "@/lib/utils";
import type { PropertyOption } from "@/lib/properties";
import { PropertyOptions } from "./property-options";

export function PropertySelect({
  properties,
  className,
}: {
  properties: PropertyOption[];
  className?: string;
}) {
  const { property, setProperty } = useFilters();
  return (
    <select
      value={property}
      onChange={(e) => setProperty(e.target.value)}
      aria-label="Property"
      className={cn(
        "border-input bg-background h-8 rounded-md border px-2 text-xs font-medium",
        className,
      )}
    >
      <option value="all">All hotels</option>
      <PropertyOptions properties={properties} />
    </select>
  );
}
