import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllMeta } from "@/lib/meta/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

// Manual trigger: POST /api/sync/meta?days=7 (protected). Pulls the rolling
// window for every Meta ad account and upserts into metrics_daily.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = new URL(request.url).searchParams.get("days");
  const days = daysParam ? Number(daysParam) : undefined;

  try {
    const summary = await syncAllMeta(days);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
