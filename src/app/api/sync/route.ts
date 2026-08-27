import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";
import type { AccountSyncResult } from "@/lib/sync/types";
import type { SyncWindow } from "@/lib/sync/dates";

export const runtime = "nodejs";
export const maxDuration = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type PlatformArg = "all" | "google" | "meta";

interface PlatformOutcome {
  platform: "google" | "meta";
  ok: boolean;
  accounts: number;
  rows: number;
  error?: string;
}

// A full month across hundreds of campaigns can take longer than the reverse
// proxy will hold a connection, so we DON'T await the pull in the request.
// Instead we start it, return immediately, and let the client poll GET for the
// result. State lives on the (single, long-running PM2) process — it survives
// across requests and resets on restart, which is fine for a manual sync.
interface SyncState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  results: PlatformOutcome[];
}
const store = globalThis as unknown as { __adsSyncState?: SyncState };
store.__adsSyncState ??= { running: false, startedAt: null, finishedAt: null, results: [] };
const state = store.__adsSyncState;

async function runOne(
  name: "google" | "meta",
  fn: (opt?: SyncWindow) => Promise<{ accounts: number; results: AccountSyncResult[] }>,
  window: SyncWindow,
  outcomes: PlatformOutcome[],
) {
  try {
    const summary = await fn(window);
    const rows = summary.results.reduce((n, r) => n + r.rowsWritten, 0);
    const failed = summary.results.filter((r) => !r.ok);
    outcomes.push({
      platform: name,
      ok: failed.length === 0,
      accounts: summary.accounts,
      rows,
      error: failed.map((f) => f.error).filter(Boolean).join("; ") || undefined,
    });
  } catch (err) {
    outcomes.push({
      platform: name,
      ok: false,
      accounts: 0,
      rows: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runSync(platform: PlatformArg, window: SyncWindow) {
  const outcomes: PlatformOutcome[] = [];
  if (platform === "all" || platform === "google") await runOne("google", syncAllGoogle, window, outcomes);
  if (platform === "all" || platform === "meta") await runOne("meta", syncAllMeta, window, outcomes);
  state.results = outcomes;
}

// POST /api/sync?platform=all|meta|google[&from&to|&days=N]
// Starts a background pull and returns 202 immediately. Owner/Admin only.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCampaigns(asRole(session.user.role)))
    return NextResponse.json({ error: "Owners and Admins only" }, { status: 403 });

  if (state.running) {
    return NextResponse.json(
      { started: false, running: true, error: "A sync is already running." },
      { status: 409 },
    );
  }

  const url = new URL(request.url);
  const platform = (url.searchParams.get("platform") ?? "all") as PlatformArg;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const daysParam = url.searchParams.get("days");
  const window: SyncWindow =
    from && to && DATE_RE.test(from) && DATE_RE.test(to)
      ? { start: from, end: to }
      : { days: daysParam ? Number(daysParam) : undefined };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.results = [];

  // A real promise that runs to completion even if the client disconnects
  // (proxy timeout on a long pull). We AWAIT it here so the work actually runs
  // on the request — a fire-and-forget promise gets abandoned in production —
  // and it also updates process state, so if this response never makes it back
  // the client still gets the result by polling GET.
  const work = runSync(platform, window)
    .catch((err) => {
      state.results = [
        { platform: "google", ok: false, accounts: 0, rows: 0, error: err instanceof Error ? err.message : String(err) },
      ];
    })
    .finally(() => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    });

  await work;
  return NextResponse.json(
    {
      done: true,
      results: state.results,
      totalRows: state.results.reduce((n, r) => n + r.rows, 0),
    },
    { status: 200 },
  );
}

// GET /api/sync — poll the background sync's progress / last result.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCampaigns(asRole(session.user.role)))
    return NextResponse.json({ error: "Owners and Admins only" }, { status: 403 });

  return NextResponse.json({
    running: state.running,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    results: state.results,
    totalRows: state.results.reduce((n, r) => n + r.rows, 0),
  });
}
