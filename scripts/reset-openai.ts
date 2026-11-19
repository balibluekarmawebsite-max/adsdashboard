import "dotenv/config";
import { prisma } from "@/lib/db";

// Clear all synced OpenAI (ChatGPT Ads) data so the next sync repopulates it
// cleanly: the daily metric rows and the campaign-registry entries for platform
// "openai". The stored API key (platform_connections) and the AdAccount link are
// KEPT — only synced data is removed. Use after a connector change that alters
// how rows are keyed (e.g. a campaign-id fix), so stale rows don't linger.
//   npm run reset:openai   &&   npm run sync:all
async function main() {
  const metrics = await prisma.metricsDaily.deleteMany({ where: { platform: "openai" } });
  const campaigns = await prisma.campaign.deleteMany({ where: { platform: "openai" } });
  console.log(
    `Cleared OpenAI data: ${metrics.count} metric rows, ${campaigns.count} campaign registry rows.`,
  );
  console.log("The API key and ad-account link are kept. Now run: npm run sync:all");
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
