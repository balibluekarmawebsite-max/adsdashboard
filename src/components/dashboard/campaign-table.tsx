"use client";

import { useMemo, useState } from "react";
import { useByCampaign, useSummary } from "@/lib/metrics/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { ChartCard } from "./chart-card";
import { formatNumber, formatMoney, formatRoas } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "campaignName" | "impressions" | "clicks" | "spend" | "conversions" | "roas";

export function CampaignTable() {
  const { data, isLoading, error } = useByCampaign();
  const { data: summary } = useSummary();
  const currency = summary?.currency ?? null;

  const [query, setQuery] = useState("");
  const q = useDebounce(query, 250);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spend",
    dir: "desc",
  });

  const rows = useMemo(() => {
    let r = data?.campaigns ?? [];
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((c) => c.campaignName.toLowerCase().includes(needle));
    }
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = a[sort.key] as string | number | null;
      const bv = b[sort.key] as string | number | null;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sign;
      return (((av as number) ?? 0) - ((bv as number) ?? 0)) * sign;
    });
  }, [data, q, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "campaignName" ? "asc" : "desc" },
    );

  const search = (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search campaigns…"
      className="border-input bg-background h-8 w-44 rounded-md border px-2.5 text-xs"
    />
  );

  return (
    <ChartCard title="Campaigns" actions={search}>
      {error ? (
        <p className="text-destructive text-sm">Couldn’t load campaigns.</p>
      ) : isLoading && rows.length === 0 ? (
        <div className="bg-muted h-40 animate-pulse rounded-md" />
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground bg-card sticky top-0 z-10">
              <tr className="border-border border-b text-xs">
                <Th onClick={() => setSortKey("campaignName")} sort={sort} col="campaignName">
                  Campaign
                </Th>
                <Th num onClick={() => setSortKey("impressions")} sort={sort} col="impressions">
                  Impr.
                </Th>
                <Th num onClick={() => setSortKey("clicks")} sort={sort} col="clicks">
                  Clicks
                </Th>
                <Th num onClick={() => setSortKey("spend")} sort={sort} col="spend">
                  Spend
                </Th>
                <Th num onClick={() => setSortKey("conversions")} sort={sort} col="conversions">
                  Conv.
                </Th>
                <Th num onClick={() => setSortKey("roas")} sort={sort} col="roas">
                  ROAS
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-10 text-center">
                    No campaigns match.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr
                    key={`${c.platform}-${c.campaignId}`}
                    className="border-border/60 hover:bg-muted/40 border-b transition-colors"
                  >
                    <td className="max-w-0 py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background:
                              c.platform === "google"
                                ? "var(--platform-google)"
                                : "var(--platform-meta)",
                          }}
                          aria-hidden
                        />
                        <span className="truncate">{c.campaignName}</span>
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(c.impressions)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(c.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(c.spend, currency)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(c.conversions)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{formatRoas(c.roas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function Th({
  children,
  num,
  onClick,
  sort,
  col,
}: {
  children: React.ReactNode;
  num?: boolean;
  onClick: () => void;
  sort: { key: string; dir: "asc" | "desc" };
  col: string;
}) {
  const active = sort.key === col;
  return (
    <th
      onClick={onClick}
      className={cn(
        "cursor-pointer py-2 font-medium select-none",
        num ? "text-right" : "text-left",
      )}
    >
      <span className={cn("inline-flex items-center gap-1", active && "text-foreground")}>
        {children}
        {active && <span className="text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
