"use client";

import { Fragment, useState, type ReactNode } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";
import { formatMoney, formatNumber, formatRoas, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InsightSnapshot } from "@/lib/ai/snapshot";
import type { InsightLanguage } from "@/lib/ai/prompt";

interface InsightResponse {
  summaryText: string | null;
  language: InsightLanguage;
  model: string | null;
  generatedAt: string | null;
  cached: boolean;
  stale: boolean;
  empty: boolean;
  error: string | null;
  snapshot: InsightSnapshot;
}

async function fetcher(url: string): Promise<InsightResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<InsightResponse>;
}

// --- Minimal, dependency-free markdown rendering for the model's output ------
function inlineBold(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={`${keyPrefix}-${i}`} className="text-foreground font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  );
}

function renderSummary(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let k = 0;
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={`ul-${k++}`} className="my-2 list-disc space-y-1.5 pl-5">
          {items.map((b, i) => (
            <li key={i}>{inlineBold(b, `li-${k}-${i}`)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const content = heading ? heading[1] : line;
    blocks.push(
      <p key={`p-${k++}`} className={cn("leading-relaxed", heading && "text-foreground font-semibold")}>
        {inlineBold(content, `p-${k}`)}
      </p>,
    );
  }
  flush();
  return blocks;
}

// --- Small pieces ------------------------------------------------------------
function LangToggle({
  value,
  onChange,
  disabled,
}: {
  value: InsightLanguage;
  onChange: (l: InsightLanguage) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-muted flex items-center rounded-md p-0.5">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          disabled={disabled}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium uppercase transition-colors disabled:opacity-50",
            value === l
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Figure({ label, value, delta }: { label: string; value: string; delta?: string | null }) {
  const favorable = delta ? delta.startsWith("+") : undefined;
  return (
    <div className="border-border bg-background/60 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-[11px] font-medium">{label}</div>
      <div className="text-foreground mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
      {delta && delta !== "—" && (
        <div
          className={cn(
            "text-[11px] tabular-nums",
            favorable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

// --- Card --------------------------------------------------------------------
export function AiSummaryCard() {
  const { from, to, platform, property } = useFilters();
  const [language, setLanguage] = useState<InsightLanguage>("en");
  const [regenerating, setRegenerating] = useState(false);

  const params = new URLSearchParams({ from, to, lang: language });
  if (platform !== "all") params.set("platform", platform);
  if (property !== "all") params.set("property", property);
  const qs = params.toString();

  const { data, error, isLoading, mutate } = useSWR<InsightResponse, Error>(
    `/api/insights?${qs}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, shouldRetryOnError: false },
  );

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/insights/generate?${qs}`, { method: "POST" });
      if (res.ok) await mutate((await res.json()) as InsightResponse, { revalidate: false });
    } finally {
      setRegenerating(false);
    }
  }

  const busy = isLoading || regenerating;
  const snap = data?.snapshot;
  const currency = snap?.currency ?? null;
  const noKey = (error?.message ?? data?.error ?? "").includes("GROQ_API_KEY");

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="border-border bg-card rounded-xl border p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold">AI Summary</h2>
          {data?.generatedAt && (
            <span className="text-muted-foreground text-xs">· updated {timeAgo(data.generatedAt)}</span>
          )}
          {data?.stale && (
            <span className="text-amber-600 dark:text-amber-400 text-xs">· showing last summary</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LangToggle value={language} onChange={setLanguage} disabled={busy} />
          <button
            onClick={regenerate}
            disabled={busy}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
            title="Regenerate"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
            Regenerate
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* Narrative */}
        <div className="text-muted-foreground min-w-0 text-sm">
          {busy && !data ? (
            <div className="space-y-2">
              <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
              <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            </div>
          ) : noKey ? (
            <p className="leading-relaxed">
              AI summaries are ready to switch on — add a{" "}
              <code className="text-foreground">GROQ_API_KEY</code> to your{" "}
              <code className="text-foreground">.env</code> and reload. The figures on the right are
              live in the meantime.
            </p>
          ) : data?.empty ? (
            <p className="leading-relaxed">No spend in this view yet — nothing to summarize.</p>
          ) : data?.summaryText ? (
            <div className="space-y-1">{renderSummary(data.summaryText)}</div>
          ) : (error || data?.error) ? (
            <p className="text-muted-foreground flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>Couldn&rsquo;t generate a summary right now: {error?.message ?? data?.error}</span>
            </p>
          ) : null}
        </div>

        {/* Key figures — always visible so the narrative is checkable */}
        {snap && (
          <div className="grid grid-cols-2 gap-2 self-start lg:grid-cols-1">
            <Figure
              label="Spend"
              value={formatMoney(snap.kpis.spend.now, currency)}
              delta={formatDelta(snap.kpis.spend.changePct)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Figure label="Impressions" value={formatNumber(snap.kpis.impressions.now)} />
              <Figure label="Clicks" value={formatNumber(snap.kpis.clicks.now)} />
            </div>
            <Figure
              label="ROAS"
              value={snap.kpis.roas.now == null ? "—" : formatRoas(snap.kpis.roas.now)}
            />
          </div>
        )}
      </div>
    </motion.section>
  );
}
