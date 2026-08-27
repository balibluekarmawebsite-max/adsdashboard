"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ChevronDown, Loader2, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type PlatformArg = "all" | "meta" | "google";

interface SyncOutcome {
  platform: string;
  ok: boolean;
  accounts: number;
  rows: number;
  error?: string;
}
interface SyncStatus {
  running: boolean;
  results: SyncOutcome[];
  totalRows: number;
}

const OPTIONS: { key: PlatformArg; label: string }[] = [
  { key: "all", label: "Meta & Google" },
  { key: "meta", label: "Meta only" },
  { key: "google", label: "Google only" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SyncButton({
  period,
  onSynced,
}: {
  period: { from: string; to: string; label: string };
  onSynced: () => void | Promise<unknown>;
}) {
  const [busy, setBusy] = useState<PlatformArg | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Start the pull (returns immediately), then poll for completion. The pull
  // runs in the background on the server so it can't be cut off by the proxy's
  // connection timeout, however long a month's data takes.
  async function sync(platform: PlatformArg) {
    setOpen(false);
    setBusy(platform);
    setMsg(null);
    try {
      const res = await fetch(`/api/sync?platform=${platform}&from=${period.from}&to=${period.to}`, {
        method: "POST",
      });
      // 202 = we started it; 409 = one was already running (we attach and poll).
      if (res.status !== 202 && res.status !== 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn’t start the sync");
      }
      await pollUntilDone();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Sync failed" });
      setBusy(null);
      await onSynced();
    }
  }

  async function pollUntilDone() {
    const startedAt = Date.now();
    const MAX_MS = 8 * 60_000;
    for (;;) {
      await sleep(4000);
      let st: SyncStatus | null = null;
      try {
        const res = await fetch("/api/sync");
        if (res.ok) st = (await res.json()) as SyncStatus;
      } catch {
        // transient network hiccup while polling — keep trying until the timeout
      }
      if (st && !st.running) {
        const results = st.results ?? [];
        const failed = results.filter((r) => !r.ok);
        const names = results.map((r) => r.platform).join(" + ");
        if (failed.length > 0) {
          setMsg({
            ok: false,
            text: `Synced with issues — ${failed.map((f) => `${f.platform}: ${f.error ?? "failed"}`).join("; ")}`,
          });
        } else {
          setMsg({
            ok: true,
            text: `Pulled ${(st.totalRows ?? 0).toLocaleString("en-US")} rows for ${period.label} from ${names || "the platforms"}. New campaigns show in the top block.`,
          });
        }
        await onSynced();
        setBusy(null);
        return;
      }
      if (Date.now() - startedAt > MAX_MS) break;
    }
    setMsg({
      ok: false,
      text: `Still pulling ${period.label} in the background — give it a minute, then reload the page.`,
    });
    await onSynced();
    setBusy(null);
  }

  const isBusy = busy !== null;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div ref={ref} className="relative inline-flex">
        {/* Primary: sync everything */}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => sync("all")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-l-md px-3.5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isBusy ? "Syncing…" : "Refresh campaigns"}
        </button>
        {/* Caret: choose a platform */}
        <button
          type="button"
          aria-label="Choose platform to sync"
          disabled={isBusy}
          onClick={() => setOpen((o) => !o)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary-foreground/20 inline-flex h-9 items-center rounded-r-md border-l px-2 transition-colors disabled:opacity-60"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        {open && (
          <div className="border-border bg-popover absolute top-10 right-0 z-20 w-44 overflow-hidden rounded-md border shadow-md">
            {OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => sync(o.key)}
                className="hover:bg-muted flex w-full items-center px-3 py-2 text-left text-sm transition-colors"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isBusy && (
        <span className="text-muted-foreground text-xs">
          Pulling in the background — this can take a couple of minutes…
        </span>
      )}
      {msg && !isBusy && (
        <span
          className={cn(
            "inline-flex items-start gap-1.5 text-xs",
            msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        >
          {msg.ok ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="max-w-[26rem]">{msg.text}</span>
        </span>
      )}
    </div>
  );
}
