import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";
import type { AccountSyncResult } from "@/lib/sync/types";
import type { SyncWindow } from "@/lib/sync/dates";

export const runtime = "nodejs";
export const maxDuration = 300; // a full pull can take a while

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type PlatformArg = "all" | "google" | "meta";

interface PlatformOutcome {
  platform: "google" | "meta";
  ok: boolean;
  accounts: number;
  rows: number;
  error?: string;
}

// POST /api/sync?platform=all|meta|google[&from=YYYY-MM-DD&to=YYYY-MM-DD | &days=N]
// Manually pull metrics and refresh the campaign registry. With from+to it
// backfills that exact period (e.g. a past month); otherwise it pulls the
// rolling window. Owner/Admin only.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCampaigns(asRole(session.user.role)))
    return NextResponse.json({ error: "Owners and Admins only" }, { status: 403 });

  const url = new URL(request.url);
  const platform = (url.searchParams.get("platform") ?? "all") as PlatformArg;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const daysParam = url.searchParams.get("days");
  const window: SyncWindow =
    from && to && DATE_RE.test(from) && DATE_RE.test(to)
      ? { start: from, end: to }
      : { days: daysParam ? Number(daysParam) : undefined };

  const outcomes: PlatformOutcome[] = [];

  async function run(
    name: "google" | "meta",
    fn: (opt?: SyncWindow) => Promise<{ accounts: number; results: AccountSyncResult[] }>,
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

  if (platform === "all" || platform === "google") await run("google", syncAllGoogle);
  if (platform === "all" || platform === "meta") await run("meta", syncAllMeta);

  const ok = outcomes.length > 0 && outcomes.every((o) => o.ok);
  const totalRows = outcomes.reduce((n, o) => n + o.rows, 0);
  // 207 = completed but at least one platform failed (partial success).
  return NextResponse.json({ ok, totalRows, results: outcomes }, { status: ok ? 200 : 207 });
}
