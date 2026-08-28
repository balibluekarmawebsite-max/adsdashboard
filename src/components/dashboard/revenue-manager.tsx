"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Trash2, Pencil, Loader2, Save, X } from "lucide-react";
import { formatMoney, formatRoas } from "@/lib/format";
import { MONTH_NAMES, monthLabel, formatDateRange } from "@/lib/revenue/constants";
import type { RevenueRow, RevenuePeriodRow } from "@/lib/revenue/query";
import type { PropertyOption } from "@/lib/properties";
import { cn } from "@/lib/utils";
import { RevenueUpload } from "./revenue-upload";
import { PropertyOptions } from "./property-options";

const fieldCls =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

type Mode = "month" | "period";

async function fetcher(url: string): Promise<{ rows: RevenueRow[]; periods: RevenuePeriodRow[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load revenue");
  return res.json() as Promise<{ rows: RevenueRow[]; periods: RevenuePeriodRow[] }>;
}

/** A month row and a period row unified for the history table. */
type HistoryRow =
  | { kind: "month"; sortKey: number; row: RevenueRow }
  | { kind: "period"; sortKey: number; row: RevenuePeriodRow };

const utcNow = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const isoDaysAgo = (n: number) => {
  const d = utcNow();
  d.setUTCDate(d.getUTCDate() - n);
  return toIso(d);
};

export function RevenueManager({ properties }: { properties: PropertyOption[] }) {
  const nowYear = new Date().getUTCFullYear();
  const nowMonth = new Date().getUTCMonth() + 1;
  const { data, mutate, isLoading } = useSWR("/api/revenue", fetcher, {
    revalidateOnFocus: false,
  });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const periods = useMemo(() => data?.periods ?? [], [data]);

  const [mode, setMode] = useState<Mode>("month");
  const [propertyCode, setPropertyCode] = useState(properties[0]?.code ?? "");
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(nowMonth);
  const [startDate, setStartDate] = useState(isoDaysAgo(6));
  const [endDate, setEndDate] = useState(isoDaysAgo(0));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2, nowYear - 3];

  // History merges both kinds, newest first.
  const history = useMemo<HistoryRow[]>(() => {
    const monthRows: HistoryRow[] = rows.map((row) => ({
      kind: "month",
      sortKey: Date.UTC(row.year, row.month - 1, 1),
      row,
    }));
    const periodRows: HistoryRow[] = periods.map((row) => ({
      kind: "period",
      sortKey: Date.parse(`${row.startDate}T00:00:00Z`),
      row,
    }));
    return [...monthRows, ...periodRows].sort((a, b) => b.sortKey - a.sortKey);
  }, [rows, periods]);

  // Overwrite warnings.
  const monthExisting = rows.find(
    (r) => r.propertyCode === propertyCode && r.year === year && r.month === month,
  );
  const periodExisting = periods.find(
    (p) =>
      p.id !== editingPeriodId &&
      p.propertyCode === propertyCode &&
      p.startDate === startDate &&
      p.endDate === endDate,
  );
  const existing = mode === "month" ? monthExisting : periodExisting;
  const isUpdate = mode === "period" ? editingPeriodId != null || !!periodExisting : !!monthExisting;

  function resetForm() {
    setAmount("");
    setNote("");
    setEditingPeriodId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "period" && endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body =
        mode === "period"
          ? {
              propertyCode,
              startDate,
              endDate,
              amount: Number(amount),
              note,
              ...(editingPeriodId ? { id: editingPeriodId } : {}),
            }
          : { propertyCode, year, month, amount: Number(amount), note };
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? "Save failed");
      }
      resetForm();
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function editMonth(r: RevenueRow) {
    setMode("month");
    setEditingPeriodId(null);
    setPropertyCode(r.propertyCode);
    setYear(r.year);
    setMonth(r.month);
    setAmount(String(r.amount));
    setNote(r.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editPeriod(r: RevenuePeriodRow) {
    setMode("period");
    setEditingPeriodId(r.id);
    setPropertyCode(r.propertyCode);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
    setAmount(String(r.amount));
    setNote(r.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeMonth(r: RevenueRow) {
    if (!confirm(`Delete revenue for ${r.propertyCode} · ${monthLabel(r.month)} ${r.year}?`)) return;
    await fetch(`/api/revenue?id=${r.id}`, { method: "DELETE" });
    await mutate();
  }

  async function removePeriod(r: RevenuePeriodRow) {
    if (!confirm(`Delete revenue for ${r.propertyCode} · ${formatDateRange(r.startDate, r.endDate)}?`))
      return;
    await fetch(`/api/revenue?periodId=${r.id}`, { method: "DELETE" });
    await mutate();
  }

  const amountNum = Number(amount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter revenue by calendar month, or for a specific date range (e.g. 21–27 Aug). ROAS
          (revenue ÷ ad spend) is computed against the ad spend for the same period.
        </p>
      </div>

      {/* Entry form */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-border bg-card rounded-xl border p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Add or update revenue</h2>
          {/* Month / date-range toggle */}
          <div className="border-border bg-muted/40 inline-flex rounded-lg border p-0.5 text-sm">
            {(["month", "period"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "month" ? "Whole month" : "Date range"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Property</span>
            <select
              value={propertyCode}
              onChange={(e) => setPropertyCode(e.target.value)}
              className={fieldCls}
            >
              <PropertyOptions properties={properties} />
            </select>
          </label>

          {mode === "month" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Month</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className={fieldCls}
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Year</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className={fieldCls}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={fieldCls}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">End date</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className={fieldCls}
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Revenue (IDR)</span>
            <input
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 150000000"
              required
              className={fieldCls}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="source, remarks…"
              className={fieldCls}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={saving || !amount}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isUpdate ? "Update" : "Save"}
            </button>
            {mode === "period" && editingPeriodId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel edit
              </button>
            )}
            <p className="text-muted-foreground text-xs">
              {mode === "period" && (
                <span>
                  {formatDateRange(startDate, endDate)}
                  {amount && amountNum >= 0 ? " · " : ""}
                </span>
              )}
              {amount && amountNum >= 0 ? formatMoney(amountNum, "IDR") : ""}
              {existing && (
                <span className="text-amber-600 dark:text-amber-400">
                  {amount || mode === "period" ? " · " : ""}Existing:{" "}
                  {formatMoney(existing.amount, existing.currency)} — saving overwrites it.
                </span>
              )}
            </p>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </motion.section>

      {/* AI document upload (monthly) */}
      <RevenueUpload
        properties={properties}
        defaultYear={year}
        defaultMonth={month}
        years={years}
        onSaved={() => mutate()}
      />

      {/* History */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="border-border bg-card rounded-xl border shadow-sm"
      >
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Revenue history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-5 py-2.5 font-medium">Property</th>
                <th className="px-5 py-2.5 font-medium">Period</th>
                <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
                <th className="px-5 py-2.5 text-right font-medium">Ad spend</th>
                <th className="px-5 py-2.5 text-right font-medium">ROAS</th>
                <th className="px-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center">
                    Loading…
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-5 py-8 text-center">
                    No revenue entered yet. Add your first month or date range above.
                  </td>
                </tr>
              ) : (
                history.map((h) => {
                  const r = h.row;
                  return (
                    <tr key={`${h.kind}-${r.id}`} className="border-border/60 border-b last:border-0">
                      <td className="px-5 py-3">
                        <span className="font-medium">{r.propertyCode}</span>
                        <span className="text-muted-foreground ml-2 hidden text-xs sm:inline">
                          {r.propertyName}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {h.kind === "month" ? (
                          <>
                            {monthLabel(h.row.month)} {h.row.year}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {formatDateRange(h.row.startDate, h.row.endDate)}
                            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                              Range
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {formatMoney(r.amount, r.currency)}
                      </td>
                      <td className="text-muted-foreground px-5 py-3 text-right tabular-nums">
                        {formatMoney(r.spend, r.currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {r.roas == null ? "—" : formatRoas(r.roas)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => (h.kind === "month" ? editMonth(h.row) : editPeriod(h.row))}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              h.kind === "month" ? removeMonth(h.row) : removePeriod(h.row)
                            }
                            className="text-muted-foreground rounded-md p-1.5 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}
