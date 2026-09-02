import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Blue Karma properties. Idempotent: safe to run repeatedly (upsert on code).
// Top-level units (parentId null): the three hotels plus WELLNESS BLUE KARMA, a
// group-wide wellness unit that sits at the same level as the hotels but is kept
// out of the blended "All hotels" total (kind = wellness, not hotel).
const PROPERTIES = [
  { code: "BKDS", name: "Blue Karma Dijiwa Seminyak", active: true, kind: "hotel" },
  { code: "BKDU", name: "Blue Karma Dijiwa Ubud", active: true, kind: "hotel" },
  { code: "BKV", name: "Blue Karma Village", active: true, kind: "hotel" },
  { code: "ORACLE", name: "Oracle Yacht", active: false, kind: "hotel" }, // hidden
  { code: "BKW", name: "WELLNESS BLUE KARMA", active: true, kind: "wellness" },
] as const;

async function main() {
  for (const p of PROPERTIES) {
    await prisma.property.upsert({
      where: { code: p.code },
      update: { name: p.name, active: p.active, kind: p.kind },
      create: { code: p.code, name: p.name, active: p.active, kind: p.kind },
    });
  }
  const count = await prisma.property.count();
  console.log(`Seeded properties. Total in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
