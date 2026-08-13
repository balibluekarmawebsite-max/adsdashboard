import "dotenv/config";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

// One-time: store META_SYSTEM_USER_TOKEN encrypted in platformConnections so the
// raw token no longer has to live in the server env. `npm run connect:meta`.
async function main() {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) {
    console.error("Set META_SYSTEM_USER_TOKEN in .env first.");
    process.exit(1);
  }

  await prisma.platformConnection.upsert({
    where: { platform_accountRef: { platform: "meta", accountRef: "meta-system-user" } },
    create: {
      platform: "meta",
      accountRef: "meta-system-user",
      secretEncrypted: encryptSecret(token),
      status: "active",
    },
    update: { secretEncrypted: encryptSecret(token), status: "active" },
  });

  console.log("Stored the Meta system user token (encrypted) in platformConnections.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
