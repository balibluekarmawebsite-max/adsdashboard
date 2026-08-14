import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-off: ensure the app has an OWNER. Idempotent — if an Owner already
// exists it does nothing; otherwise it promotes the earliest-registered user
// (the person who bootstrapped the install) to OWNER. Safe to run repeatedly.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (owner) {
    console.log(`An Owner already exists (${owner.email}). Nothing to do.`);
    return;
  }

  const first = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) {
    console.log("No users yet — the first person to register will become Owner.");
    return;
  }

  await prisma.user.update({ where: { id: first.id }, data: { role: "OWNER" } });
  console.log(`Promoted ${first.email} to OWNER.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
