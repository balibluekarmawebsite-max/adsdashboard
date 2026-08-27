"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { CampaignRow } from "@/lib/campaigns/query";
import { cn } from "@/lib/utils";

type PropertyOption = { code: string; name: string };

interface CampaignsResponse {
  campaigns: CampaignRow[];
  pendingCount: number;
}

async function fetcher(url: string): Promise<CampaignsResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json() as Promise<CampaignsResponse>;
}

const selectCls =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none";

function ReportSwitch({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        on ? "bg-emerald-500" : "bg-muted-foreground/30",
      )}
      title={on ? "On the report — click to hide" : "Hidden — click to add"}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function CampaignManager({ properties }: { properties: PropertyOption[] }) {
  const { data, mutate, isLoading } = useSWR("/api/campaigns", fetcher, {
    revalidateOnFocus: false,
  });
  const campaigns = data?.campaigns ?? [];
  const pendingCount = data?.pendingCount ?? 0;
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, string>) {
    setBusy(id);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) await mutate();
    } finally {
      setBusy(null);
    }
  }

  const toggle = (c: CampaignRow, on: boolean) =>
    patch(c.id, { status: on ? "included" : "excluded" });
  const reassign = (c: CampaignRow, propertyCode: string) => patch(c.id, { propertyCode });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Assign each campaign to the right unit and toggle whether it appears on the report. New
          campaigns arrive <span className="text-amber-600 dark:text-amber-400">off the report</span>{" "}
          until you switch them on.
        </p>
      </div>

      {pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-xl border px-4 py-3 text-sm"
        >
          <strong>
            {pendingCount} new campaign{pendingCount === 1 ? "" : "s"} to review.
          </strong>{" "}
          Check the unit is correct, then switch on the ones you want on the report.
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-5 py-2.5 font-medium">Campaign</th>
                <th className="px-5 py-2.5 font-medium">Unit</th>
                <th className="px-5 py-2.5 font-medium">Platform</th>
                <th className="px-5 py-2.5 text-right font-medium">Spend (30d)</th>
                <th className="px-5 py-2.5 text-center font-medium">On report</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center">
                    Loading…
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-5 py-8 text-center">
                    No campaigns discovered yet. They appear here after a sync.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="border-border/60 border-b last:border-0">
                    <td className="max-w-[22rem] px-5 py-3">
                      <div className="truncate font-medium" title={c.name}>
                        {c.name}
                      </div>
                      {c.status === "pending" && (
                        <span className="text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                          New — review
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={c.propertyCode ?? ""}
                        disabled={busy === c.id}
                        onChange={(e) => reassign(c, e.target.value)}
                        className={selectCls}
                      >
                        {c.propertyCode == null && <option value="">— unassigned —</option>}
                        {properties.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-muted-foreground px-5 py-3 capitalize">{c.platform}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(c.spend30d, "IDR", { compact: true })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center">
                        {busy === c.id ? (
                          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        ) : (
                          <ReportSwitch
                            on={c.status === "included"}
                            onToggle={(next) => toggle(c, next)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}
