import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Blue Karma properties. Idempotent: safe to run repeatedly (upsert on code).
const PROPERTIES = [
  { code: "BKDS", name: "Blue Karma Seminyak", active: true },
  { code: "BKDU", name: "Blue Karma Ubud", active: true },
  { code: "BKV", name: "Blue Karma Village", active: true },
  { code: "ORACLE", name: "Oracle Yacht", active: false }, // hidden from the dashboard
] as const;

async function main() {
  for (const p of PROPERTIES) {
    await prisma.property.upsert({
      where: { code: p.code },
      update: { name: p.name, active: p.active },
      create: { code: p.code, name: p.name, active: p.active },
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
