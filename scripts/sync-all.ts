import "dotenv/config";
import { syncAllGoogle } from "@/lib/google/sync";
import { syncAllMeta } from "@/lib/meta/sync";

// Run both connectors. Used by the daily cron in Phase 5. Each platform is
// independent — one failing does not stop the other.
const arg = process.argv[2];
const days = arg ? Number(arg) : undefined;

async function main() {
  const google = await syncAllGoogle(days).catch((err) => ({
    platform: "google" as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  const meta = await syncAllMeta(days).catch((err) => ({
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
