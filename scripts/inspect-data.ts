import "dotenv/config";
import { prisma } from "@/lib/db";

// Read-only health check: what metrics data actually landed in the database,
// what date range it covers, which property it's attached to, and the real
// campaign names (so we can see whether the BKDU/BKV/BKDS prefixes matched).
//
//   npm run data:inspect

function fmt(n: unknown): string {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function day(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

async function main() {
  const total = await prisma.metricsDaily.count();
  const today = new Date();
  const win = new Date(today);
  win.setDate(win.getDate() - 29);
  console.log(`\nToday: ${day(today)}   |   default dashboard window (30d): ${day(win)} → ${day(today)}`);
  console.log(`Total MetricsDaily rows: ${total}`);
  if (total === 0) {
    console.log("\n⚠️  No metric rows at all — nothing has been synced into the database yet.");
    return;
  }

  // By platform: how much, and — crucially — what date range does it span?
  const byPlatform = await prisma.metricsDaily.groupBy({
    by: ["platform"],
    _count: { _all: true },
    _min: { date: true },
    _max: { date: true },
    _sum: { spend: true, impressions: true },
  });
  console.log("\nBy platform:");
  console.log("  platform  rows    dates (min → max)          spend        impressions");
  for (const p of byPlatform) {
    console.log(
      `  ${p.platform.padEnd(8)}  ${String(p._count._all).padEnd(6)}  ${day(p._min.date)} → ${day(
        p._max.date,
      )}   ${fmt(p._sum.spend).padStart(11)}  ${fmt(p._sum.impressions).padStart(11)}`,
    );
  }

  // By property (join codes so it's readable).
  const byProp = await prisma.metricsDaily.groupBy({
    by: ["propertyId"],
    _count: { _all: true },
    _sum: { spend: true },
  });
  const props = await prisma.property.findMany({ select: { id: true, code: true, active: true } });
  const codeById = new Map(props.map((p) => [p.id, `${p.code}${p.active ? "" : " (hidden)"}`]));
  console.log("\nBy property:");
  for (const g of byProp) {
    console.log(`  ${(codeById.get(g.propertyId) ?? g.propertyId).padEnd(16)}  rows ${String(g._count._all).padEnd(6)}  spend ${fmt(g._sum.spend)}`);
  }

  // Real campaign names — reveals whether prefixes (BKDU/BKV/BKDS) are present.
  const byCamp = await prisma.metricsDaily.groupBy({
    by: ["campaignName", "platform"],
    _sum: { spend: true },
    orderBy: { _sum: { spend: "desc" } },
    take: 40,
  });
  console.log("\nTop campaigns by spend (actual names):");
  for (const c of byCamp) {
    console.log(`  [${c.platform.padEnd(6)}] ${fmt(c._sum.spend).padStart(10)}  ${c.campaignName}`);
  }

  // Linked accounts + routes, for context.
  const accounts = await prisma.adAccount.findMany({
    include: { property: { select: { code: true } } },
    orderBy: { platform: "asc" },
  });
  console.log("\nLinked ad accounts:");
  for (const a of accounts) {
    console.log(`  ${a.platform.padEnd(6)}  ${a.externalAccountId.padEnd(16)}  → default ${a.property.code}  (${a.currency})`);
  }

  const routes = await prisma.campaignRoute.findMany({
    include: { adAccount: { select: { platform: true, externalAccountId: true } }, property: { select: { code: true } } },
    orderBy: [{ adAccountId: "asc" }, { priority: "desc" }],
  });
  console.log("\nCampaign routes:");
  if (routes.length === 0) console.log("  (none)");
  for (const r of routes) {
    console.log(`  ${r.adAccount.platform.padEnd(6)} ${r.adAccount.externalAccountId}  ${r.isRegex ? `/${r.pattern}/i` : `"${r.pattern}"`} → ${r.property.code}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
