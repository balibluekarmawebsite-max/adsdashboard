"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Loader2, Check, TriangleAlert, ListPlus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { CampaignRow } from "@/lib/campaigns/query";
import type { PropertyOption } from "@/lib/properties";
import { cn } from "@/lib/utils";
import { PropertyOptions } from "./property-options";
import { SyncButton } from "./sync-button";

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

// --- Spend windows: "Last 30 days" plus the last 12 calendar months ---------
interface Period {
  key: string;
  label: string;
  from: string;
  to: string;
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function buildPeriods(): Period[] {
  const today = new Date();
  const from30 = new Date(today);
  from30.setDate(from30.getDate() - 29);
  const periods: Period[] = [
    { key: "30d", label: "Last 30 days", from: ymd(from30), to: ymd(today) },
  ];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const mm = String(m + 1).padStart(2, "0");
    periods.push({
      key: `${y}-${mm}`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${String(last).padStart(2, "0")}`,
    });
  }
  return periods;
}

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

/** The campaigns table for one set of rows (reused by both blocks). */
function CampaignsTable({
  rows,
  properties,
  busy,
  onToggle,
  onReassign,
  periodLabel,
}: {
  rows: CampaignRow[];
  properties: PropertyOption[];
  busy: string | null;
  onToggle: (c: CampaignRow, on: boolean) => void;
  onReassign: (c: CampaignRow, code: string) => void;
  periodLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-xs">
            <th className="px-5 py-2.5 font-medium">Campaign</th>
            <th className="px-5 py-2.5 font-medium">Unit</th>
            <th className="px-5 py-2.5 font-medium">Platform</th>
            <th className="px-5 py-2.5 text-right font-medium">Spend · {periodLabel}</th>
            <th className="px-5 py-2.5 text-center font-medium">On report</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-border/60 border-b last:border-0">
              <td className="max-w-[22rem] px-5 py-3">
                <div className="truncate font-medium" title={c.name}>
                  {c.name}
                </div>
              </td>
              <td className="px-5 py-3">
                <select
                  value={c.propertyCode ?? ""}
                  disabled={busy === c.id}
                  onChange={(e) => onReassign(c, e.target.value)}
                  className={selectCls}
                >
                  {c.propertyCode == null && <option value="">— unassigned —</option>}
                  <PropertyOptions properties={properties} />
                </select>
              </td>
              <td className="text-muted-foreground px-5 py-3 capitalize">{c.platform}</td>
              <td
                className={cn(
                  "px-5 py-3 text-right tabular-nums",
                  c.spend === 0 && "text-muted-foreground/50",
                )}
              >
                {formatMoney(c.spend, "IDR")}
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-center">
                  {busy === c.id ? (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  ) : (
                    <ReportSwitch on={c.status === "included"} onToggle={(next) => onToggle(c, next)} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignManager({ properties }: { properties: PropertyOption[] }) {
  const periods = useMemo(() => buildPeriods(), []);
  const [periodKey, setPeriodKey] = useState("30d");
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const [onlyWithSpend, setOnlyWithSpend] = useState(false);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `/api/campaigns?from=${period.from}&to=${period.to}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  const campaigns = data?.campaigns ?? [];
  const rows = onlyWithSpend ? campaigns.filter((c) => c.spend > 0) : campaigns;
  // Split so newly-detected campaigns (pending) sit in their own block on top,
  // and everything already reviewed stays in the main list below.
  const pending = rows.filter((c) => c.status === "pending");
  const reviewed = rows.filter((c) => c.status !== "pending");

  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  async function addAllWithSpend() {
    if (
      !confirm(
        `Turn on every campaign that spent in ${period.label}? They'll be added to the report — nothing already on it is turned off.`,
      )
    )
      return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "include-with-spend", from: period.from, to: period.to }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        updated?: number;
        matched?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      const updated = body.updated ?? 0;
      const matched = body.matched ?? 0;
      setBulkMsg({
        ok: true,
        text: updated
          ? `Added ${updated} campaign${updated === 1 ? "" : "s"} to the report (${matched} spent in ${period.label}).`
          : `All ${matched} campaign${matched === 1 ? "" : "s"} that spent in ${period.label} are already on the report.`,
      });
      await mutate();
    } catch (err) {
      setBulkMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Assign each campaign to the right unit and toggle whether it appears on the report.
            Refresh pulls the <span className="font-medium">period selected below</span> — pick a
            month to backfill older campaigns. New campaigns arrive{" "}
            <span className="text-amber-600 dark:text-amber-400">off the report</span> until you
            switch them on.
          </p>
        </div>
        <SyncButton period={period} onSynced={() => mutate()} />
      </div>

      {/* Spend period + bulk curation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Spend in</span>
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className={selectCls}
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm select-none">
            <input
              type="checkbox"
              checked={onlyWithSpend}
              onChange={(e) => setOnlyWithSpend(e.target.checked)}
              className="accent-primary h-3.5 w-3.5"
            />
            Only campaigns with spend
          </label>
        </div>
        <button
          type="button"
          onClick={addAllWithSpend}
          disabled={bulkBusy}
          className="border-border hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors disabled:opacity-60"
          title={`Add every campaign that spent in ${period.label} to the report`}
        >
          {bulkBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListPlus className="h-4 w-4" />
          )}
          Add all that spent
        </button>
      </div>
      {bulkMsg && (
        <div
          className={cn(
            "flex items-start gap-1.5 text-xs",
            bulkMsg.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}
        >
          {bulkMsg.ok ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{bulkMsg.text}</span>
        </div>
      )}

      {error && !data ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-xl border p-5 text-sm shadow-sm">
          <p className="font-medium">Couldn’t load campaigns.</p>
          <p className="mt-1 opacity-90">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 rounded-md border border-current px-3 py-1.5 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      ) : isLoading && !data ? (
        <div className="border-border bg-card text-muted-foreground rounded-xl border p-10 text-center text-sm shadow-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground rounded-xl border p-10 text-center text-sm shadow-sm">
          No campaigns discovered yet. Click{" "}
          <span className="text-foreground font-medium">Refresh campaigns</span> to pull them from
          Meta &amp; Google.
        </div>
      ) : (
        <>
          {/* New campaigns from the latest sync — review, then they move below */}
          {pending.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 px-5 py-3">
                <p className="text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {pending.length} new campaign{pending.length === 1 ? "" : "s"} to review
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · assign a unit, then switch on the ones for the report
                  </span>
                </p>
                {isValidating && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
              </div>
              <CampaignsTable
                rows={pending}
                properties={properties}
                busy={busy}
                onToggle={toggle}
                onReassign={reassign}
                periodLabel={period.label}
              />
            </motion.section>
          )}

          {/* The persistent list — everything already reviewed */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold">
                {pending.length > 0 ? "On the report & hidden" : "Campaigns"}
                <span className="text-muted-foreground ml-2 font-normal">{reviewed.length}</span>
              </h2>
              {isValidating && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
            </div>
            {reviewed.length === 0 ? (
              <p className="text-muted-foreground px-5 py-8 text-center text-sm">
                {onlyWithSpend
                  ? `No reviewed campaigns with spend in ${period.label}.`
                  : "Review the new campaigns above — they’ll move here once you switch them on or off."}
              </p>
            ) : (
              <CampaignsTable
                rows={reviewed}
                properties={properties}
                busy={busy}
                onToggle={toggle}
                onReassign={reassign}
                periodLabel={period.label}
              />
            )}
          </motion.section>
        </>
      )}
    </div>
  );
}
