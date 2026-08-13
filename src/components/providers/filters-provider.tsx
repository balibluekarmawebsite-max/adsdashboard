"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PlatformFilter = "all" | "google" | "meta";
export type PresetKey = "7d" | "30d" | "mtd" | "lastMonth" | "custom";

export interface FiltersState {
  from: string;
  to: string;
  preset: PresetKey;
  platform: PlatformFilter;
  property: string; // "all" or a property code
}

interface FiltersContextValue extends FiltersState {
  setPreset: (preset: PresetKey) => void;
  setCustomRange: (from: string, to: string) => void;
  setPlatform: (platform: PlatformFilter) => void;
  setProperty: (property: string) => void;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function rangeForPreset(preset: PresetKey): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case "7d":
      return { from: ymd(daysAgo(6)), to: ymd(today) };
    case "mtd":
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case "lastMonth":
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "30d":
    default:
      return { from: ymd(daysAgo(29)), to: ymd(today) };
  }
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const initial = rangeForPreset("30d");
  const [state, setState] = useState<FiltersState>({
    ...initial,
    preset: "30d",
    platform: "all",
    property: "all",
  });

  const value = useMemo<FiltersContextValue>(
    () => ({
      ...state,
      setPreset: (preset) =>
        setState((s) => ({
          ...s,
          preset,
          ...(preset === "custom" ? {} : rangeForPreset(preset)),
        })),
      setCustomRange: (from, to) => setState((s) => ({ ...s, preset: "custom", from, to })),
      setPlatform: (platform) => setState((s) => ({ ...s, platform })),
      setProperty: (property) => setState((s) => ({ ...s, property })),
    }),
    [state],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}
