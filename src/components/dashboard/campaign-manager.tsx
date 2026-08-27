"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { CheckCircle2, EyeOff, Plus, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { STATUS_LABEL, type ReportStatus } from "@/lib/campaigns/constants";
import type { CampaignRow } from "@/lib/campaigns/query";
import { cn } from "@/lib/utils";

interface CampaignsResponse {
  campaigns: CampaignRow[];
  pendingCount: number;
}

async function fetcher(url: string): Promise<CampaignsResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json() as Promise<CampaignsResponse>;
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  included: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  excluded: "bg-muted text-muted-foreground",
};

export function CampaignManager() {
  const { data, mutate, isLoading } = useSWR("/api/campaigns", fetcher, {
    revalidateOnFocus: false,
  });
  const campaigns = data?.campaigns ?? [];
  const pendingCount = data?.pendingCount ?? 0;
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: ReportStatus) {
    setBusy(id);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose which campaigns appear on the report. New campaigns arrive as{" "}
          <span className="text-amber-600 dark:text-amber-400">New — review</span> and stay off the
          report until you add them.
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
          Add the ones you want on the owner report — the rest stay hidden.
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
                <th className="px-5 py-2.5 font-medium">Property</th>
                <th className="px-5 py-2.5 font-medium">Platform</th>
                <th className="px-5 py-2.5 text-right font-medium">Spend (30d)</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center">
                    Loading…
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center">
                    No campaigns discovered yet. They appear here after a sync.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="border-border/60 border-b last:border-0">
                    <td className="max-w-[22rem] truncate px-5 py-3 font-medium" title={c.name}>
                      {c.name}
                    </td>
                    <td className="px-5 py-3">{c.propertyCode ?? "—"}</td>
                    <td className="text-muted-foreground px-5 py-3 capitalize">{c.platform}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(c.spend30d, "IDR", { compact: true })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_CLASS[c.status],
                        )}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {busy === c.id ? (
                          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        ) : c.status === "included" ? (
                          <button
                            onClick={() => setStatus(c.id, "excluded")}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                          >
                            <EyeOff className="h-3.5 w-3.5" /> Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(c.id, "included")}
                            className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:bg-emerald-500/10"
                          >
                            {c.status === "pending" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Add to report
                          </button>
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
