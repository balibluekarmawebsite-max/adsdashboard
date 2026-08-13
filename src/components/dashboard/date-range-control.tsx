"use client";

import { useState } from "react";
import { useFilters, type PresetKey } from "@/components/providers/filters-provider";
import { cn } from "@/lib/utils";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "mtd", label: "MTD" },
  { key: "lastMonth", label: "Last mo" },
];

export function DateRangeControl() {
  const { preset, from, to, setPreset, setCustomRange } = useFilters();
  const [customOpen, setCustomOpen] = useState(false);

  const chip = (active: boolean) =>
    cn(
      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted flex items-center rounded-md p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPreset(p.key);
              setCustomOpen(false);
            }}
            className={chip(preset === p.key)}
          >
            {p.label}
          </button>
        ))}
        <button onClick={() => setCustomOpen((o) => !o)} className={chip(preset === "custom")}>
          Custom
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setCustomRange(e.target.value, to)}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setCustomRange(from, e.target.value)}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}
