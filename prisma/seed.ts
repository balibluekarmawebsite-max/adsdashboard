import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Blue Karma properties. Idempotent: safe to run repeatedly (upsert on code).
const PROPERTIES = [
  { code: "BKDS", name: "Blue Karma Seminyak" },
  { code: "BKDU", name: "Blue Karma Ubud" },
  { code: "BKV", name: "Blue Karma Village" },
  { code: "ORACLE", name: "Oracle Yacht" },
] as const;

async function main() {
  for (const p of PROPERTIES) {
    await prisma.property.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: { code: p.code, name: p.name },
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
