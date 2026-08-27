import "dotenv/config";
import { prisma } from "@/lib/db";
import { OUTLETS } from "@/lib/campaigns/outlets";

// Create (or refresh) the restaurant & spa outlets that sit under each hotel.
// Idempotent — safe to re-run. The parent hotels (BKDU/BKDS/BKV) must exist
// first; any outlet whose parent is missing is skipped with a note.
//
//   npm run outlets:seed

async function main() {
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const o of OUTLETS) {
    const parent = await prisma.property.findUnique({ where: { code: o.parentCode } });
    if (!parent) {
      skipped.push(`${o.code} — parent ${o.parentCode} not found`);
      continue;
    }

    const existing = await prisma.property.findUnique({ where: { code: o.code } });
    if (existing) {
      await prisma.property.update({
        where: { code: o.code },
        data: { name: o.name, kind: o.kind, parentId: parent.id, active: true },
      });
      updated++;
      console.log(`~ ${o.code.padEnd(9)} ${o.name}  (under ${o.parentCode})`);
    } else {
      await prisma.property.create({
        data: { code: o.code, name: o.name, kind: o.kind, parentId: parent.id, active: true },
      });
      created++;
      console.log(`+ ${o.code.padEnd(9)} ${o.name}  (under ${o.parentCode})`);
    }
  }

  console.log(`\nOutlets: ${created} created, ${updated} updated.`);
  if (skipped.length) {
    console.log(`Skipped:\n  ${skipped.join("\n  ")}`);
    console.log(`\nSeed the hotels first, then re-run \`npm run outlets:seed\`.`);
  }
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
