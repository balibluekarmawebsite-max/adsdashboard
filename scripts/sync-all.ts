import "dotenv/config";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";
import type { SyncWindow } from "@/lib/sync/dates";

// Run both connectors. Each platform is independent — one failing does not stop
// the other. Rolling window by default; pass --from/--to to backfill a past
// period (e.g. a full month), which is the reliable way to pull older data:
//   npm run sync:all                                   (rolling default)
//   npm run sync:all -- 60                              (rolling 60 days)
//   npm run sync:all -- --from 2026-04-01 --to 2026-04-30
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const positional = process.argv[2];
const from = flag("from");
const to = flag("to");
const opt: SyncWindow =
  from && to
    ? { start: from, end: to }
    : { days: positional && !positional.startsWith("--") ? Number(positional) : undefined };

async function main() {
  const google = await syncAllGoogle(opt).catch((err) => ({
    platform: "google" as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  const meta = await syncAllMeta(opt).catch((err) => ({
    platform: "meta" as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  console.log(JSON.stringify({ google, meta }, null, 2));

  const failed =
    ("error" in google && google.error) ||
    ("error" in meta && meta.error) ||
    ("results" in google && google.results.some((r) => !r.ok)) ||
    ("results" in meta && meta.results.some((r) => !r.ok));
  process.exit(failed ? 1 : 0);
}

main();
