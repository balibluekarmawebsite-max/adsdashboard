"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { setReportVariance } from "@/lib/reports/actions";

/**
 * Global switch for the period-over-period variance %. When on, the ▲▼ change
 * shows on the dashboard, exports and emailed reports; when off, it's hidden
 * everywhere.
 */
export function VarianceToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setErr(null);
    start(async () => {
      const res = await setReportVariance(next);
      if (res?.error) {
        setOn(!next); // revert
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-accent text-accent-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Variance percentage</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Show the period-over-period change (▲▼ %) on the dashboard, exported files (PDF, Excel,
              PowerPoint) and emailed reports. Turn off to hide it everywhere.
            </p>
            {err && <p className="text-destructive mt-1.5 text-xs">{err}</p>}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Toggle variance percentage"
          disabled={busy}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-60",
            on ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
              on ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Currently <span className="font-medium">{on ? "shown" : "hidden"}</span>.
      </p>
    </section>
  );
}
