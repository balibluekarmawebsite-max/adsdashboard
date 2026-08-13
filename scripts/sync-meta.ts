import "dotenv/config";
import { syncAllMeta } from "@/lib/meta/sync";

// CLI entry: `npm run sync:meta [days]` — used by the daily cron in Phase 5.
const arg = process.argv[2];
const days = arg ? Number(arg) : undefined;

syncAllMeta(days)
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.results.every((r) => r.ok) ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
