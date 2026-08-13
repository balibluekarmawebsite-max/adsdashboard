"use client";

import { useFilters, type PlatformFilter } from "@/components/providers/filters-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { key: PlatformFilter; label: string; dot?: string }[] = [
  { key: "all", label: "All" },
  { key: "google", label: "Google", dot: "var(--platform-google)" },
  { key: "meta", label: "Meta", dot: "var(--platform-meta)" },
];

export function PlatformToggle() {
  const { platform, setPlatform } = useFilters();
  return (
    <div className="bg-muted flex items-center rounded-md p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => setPlatform(o.key)}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            platform === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.dot && (
            <span className="h-2 w-2 rounded-full" style={{ background: o.dot }} aria-hidden />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
