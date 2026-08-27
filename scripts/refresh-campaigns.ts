import "dotenv/config";
import { prisma } from "@/lib/db";
import { refreshCampaignRegistry } from "@/lib/campaigns/registry";

// Populate/refresh the campaign registry from synced metrics.
//   npm run campaigns:refresh
// First run grandfathers existing campaigns as "included"; later runs mark
// genuinely new campaigns as "pending" for review.

refreshCampaignRegistry()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
