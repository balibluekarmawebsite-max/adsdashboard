"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Sparkles, Trash2, Save, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/revenue/constants";
import type { PropertyOption } from "@/lib/properties";
import { PropertyOptions } from "./property-options";

interface DraftRow {
  propertyCode: string;
  amount: string;
  month: number;
  year: number;
  note: string;
}

const fieldCls =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

export function RevenueUpload({
  properties,
  defaultYear,
  defaultMonth,
  years,
  onSaved,
}: {
  properties: PropertyOption[];
  defaultYear: number;
  defaultMonth: number;
  years: number[];
  onSaved: () => void | Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onFile(file: File) {
    setExtracting(true);
    setError(null);
    setNotice(null);
    setRows([]);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/revenue/extract", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        entries?: Array<{
          propertyCode: string;
          amount: number | null;
          month: number | null;
          year: number | null;
          note: string | null;
        }>;
        model?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Extraction failed");
      const entries = body.entries ?? [];
      setModel(body.model ?? null);
      if (entries.length === 0) {
        setNotice("No revenue figures were found. Try a clearer document, or enter them manually above.");
      }
      setRows(
        entries.map((e) => ({
          propertyCode: e.propertyCode,
          amount: e.amount != null ? String(e.amount) : "",
          month: e.month ?? defaultMonth,
          year: e.year ?? defaultYear,
          note: e.note ?? "",
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function update(i: number, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
  }
  function reset() {
    setRows([]);
    setFileName(null);
    setError(null);
    setNotice(null);
  }

  async function saveAll() {
    const valid = rows.filter((r) => r.propertyCode && r.amount !== "" && Number(r.amount) >= 0);
    if (valid.length === 0) {
      setError("Nothing to save — add an amount to at least one row.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const r of valid) {
        const res = await fetch("/api/revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyCode: r.propertyCode,
            year: r.year,
            month: r.month,
            amount: Number(r.amount),
            note: r.note,
            source: fileName ? `upload:${fileName}` : "upload",
          }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(b.error ?? "Save failed");
        }
      }
      reset();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-border bg-card rounded-xl border p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold">Upload a document — AI extracts the revenue</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-xs">
        Excel, CSV, or a screenshot. The AI reads it into a draft you review before saving — nothing
        is stored until you confirm.
      </p>

      {/* Upload control */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={extracting || saving}
          className="border-border hover:bg-muted inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {extracting ? "Reading…" : "Choose file"}
        </button>
        {fileName && !extracting && <span className="text-muted-foreground text-xs">{fileName}</span>}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {notice && <p className="text-muted-foreground mt-3 text-sm">{notice}</p>}

      {/* Draft review */}
      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Review &amp; edit, then save. {model && <span>Extracted by {model}.</span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="py-2 pr-3 font-medium">Property</th>
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">Year</th>
                  <th className="py-2 pr-3 font-medium">Revenue (IDR)</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-border/60 border-b last:border-0">
                    <td className="py-2 pr-3">
                      <select
                        value={r.propertyCode}
                        onChange={(e) => update(i, { propertyCode: e.target.value })}
                        className={fieldCls}
                      >
                        <PropertyOptions properties={properties} />
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={r.month}
                        onChange={(e) => update(i, { month: Number(e.target.value) })}
                        className={fieldCls}
                      >
                        {MONTH_NAMES.map((m, j) => (
                          <option key={m} value={j + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={r.year}
                        onChange={(e) => update(i, { year: Number(e.target.value) })}
                        className={fieldCls}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0}
                        value={r.amount}
                        onChange={(e) => update(i, { amount: e.target.value })}
                        className={`${fieldCls} w-40`}
                      />
                      <div className="text-muted-foreground mt-0.5 text-[11px]">
                        {r.amount ? formatMoney(Number(r.amount), "IDR") : ""}
                      </div>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-muted-foreground rounded-md p-1.5 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={saveAll}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </button>
            <button
              onClick={reset}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
