"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useFilters, type PresetKey } from "@/components/providers/filters-provider";
import { cn } from "@/lib/utils";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "mtd", label: "MTD" },
  { key: "lastMonth", label: "Last mo" },
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// --- date helpers (all local-time, YYYY-MM-DD strings) ---------------------
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function niceDate(s: string): string {
  return parseYmd(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
/** Cells for a month grid, Monday-first, with leading/trailing null padding. */
function monthCells(view: Date): (Date | null)[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateRangeControl() {
  const { preset, from, to, setPreset, setCustomRange } = useFilters();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => parseYmd(to));
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPicker() {
    setView(parseYmd(to));
    setPendingStart(null);
    setHover(null);
    setOpen(true);
  }

  function pickDay(d: Date) {
    const s = ymd(d);
    if (!pendingStart) {
      setPendingStart(s);
      setHover(s);
      return;
    }
    let a = pendingStart;
    let b = s;
    if (a > b) [a, b] = [b, a];
    setCustomRange(a, b);
    setPendingStart(null);
    setOpen(false);
  }

  const todayStr = ymd(new Date());

  // Which range to paint: a half-made selection (start→hover) or the applied one.
  let lo = from;
  let hi = to;
  if (pendingStart) {
    lo = pendingStart;
    hi = hover ?? pendingStart;
    if (lo > hi) [lo, hi] = [hi, lo];
  }

  const chip = (active: boolean) =>
    cn(
      "rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div ref={ref} className="relative flex items-center">
      <div className="bg-muted flex items-center rounded-md p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPreset(p.key);
              setOpen(false);
            }}
            className={chip(preset === p.key)}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => (open ? setOpen(false) : openPicker())}
          className={cn(chip(preset === "custom"), "inline-flex items-center gap-1")}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {preset === "custom" ? (
            <>
              <span className="hidden md:inline">
                {niceDate(from)} – {niceDate(to)}
              </span>
              <span className="md:hidden">Custom</span>
            </>
          ) : (
            "Custom"
          )}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="border-border bg-popover absolute top-full right-0 z-30 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-lg border p-3 shadow-lg"
        >
          {/* Month header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v, -1))}
              aria-label="Previous month"
              className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">
              {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v, 1))}
              aria-label="Next month"
              className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="text-muted-foreground mb-1 grid grid-cols-7 text-center text-[11px] font-medium">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7" onMouseLeave={() => pendingStart && setHover(pendingStart)}>
            {monthCells(view).map((d, i) => {
              if (!d) return <div key={`x${i}`} />;
              const s = ymd(d);
              const disabled = s > todayStr;
              const isStart = s === lo;
              const isEnd = s === hi;
              const inRange = s > lo && s < hi;
              const selected = isStart || isEnd;
              return (
                <div
                  key={s}
                  className={cn(
                    "flex justify-center py-0.5",
                    inRange && "bg-primary/12",
                    isStart && hi !== lo && "bg-primary/12 rounded-l-full",
                    isEnd && hi !== lo && "bg-primary/12 rounded-r-full",
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(d)}
                    onMouseEnter={() => pendingStart && setHover(s)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors",
                      disabled && "text-muted-foreground/40 cursor-not-allowed",
                      !disabled && !selected && "hover:bg-muted",
                      selected && "bg-primary text-primary-foreground font-semibold",
                      !selected && !inRange && s === todayStr && "text-primary font-semibold",
                    )}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
            <span className="text-muted-foreground text-xs">
              {pendingStart ? "Now pick the end date" : `${niceDate(from)} – ${niceDate(to)}`}
            </span>
            {pendingStart && (
              <button
                type="button"
                onClick={() => {
                  setPendingStart(null);
                  setHover(null);
                }}
                className="text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
