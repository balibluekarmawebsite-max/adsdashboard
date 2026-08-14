import "dotenv/config";
import { prisma } from "@/lib/db";

// Link an external ad account (Google customer id or Meta act_ id) to a property,
// creating the AdAccount row the sync engine reads. Reusable for both platforms.
//
//   npm run link:account -- --platform meta   --property BKDS --account act_1234567890 --name "BKDS · Meta" --currency IDR
//   npm run link:account -- --platform google --property BKDU --account 123-456-7890    --name "BKDU · Google" --currency IDR
//   npm run link:account -- --list          # show everything linked so far

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Ad account ids are stored as digits only; the connectors re-add act_/format. */
function digits(s: string): string {
  return s.replace(/^act_/i, "").replace(/[^0-9]/g, "");
}

async function list() {
  const accounts = await prisma.adAccount.findMany({
    include: { property: { select: { code: true } } },
    orderBy: [{ platform: "asc" }, { accountName: "asc" }],
  });
  if (accounts.length === 0) {
    console.log("No ad accounts linked yet.");
    return;
  }
  console.log("platform  property  account          cur  name");
  for (const a of accounts) {
    console.log(
      `${a.platform.padEnd(8)}  ${a.property.code.padEnd(8)}  ${a.externalAccountId.padEnd(15)}  ${a.currency}  ${a.accountName}`,
    );
  }
}

async function main() {
  if (process.argv.includes("--list")) return list();

  const platform = arg("platform");
  const propertyCode = arg("property");
  const accountRaw = arg("account");
  const name = arg("name");
  const currency = (arg("currency") ?? "IDR").toUpperCase();

  const usage =
    'Usage:\n  npm run link:account -- --platform <google|meta> --property <CODE> --account <id> --name "<label>" [--currency IDR]\n  npm run link:account -- --list';

  if (platform !== "google" && platform !== "meta") throw new Error(`--platform must be "google" or "meta".\n${usage}`);
  if (!propertyCode || !accountRaw || !name) throw new Error(usage);
  if (currency.length !== 3) throw new Error("--currency must be a 3-letter ISO code, e.g. IDR.");

  const property = await prisma.property.findUnique({ where: { code: propertyCode } });
  if (!property) throw new Error(`No property with code "${propertyCode}". Run \`npm run db:seed\` first.`);

  const externalAccountId = digits(accountRaw);
  if (!externalAccountId) throw new Error(`Could not read an account id from "${accountRaw}".`);

  const acc = await prisma.adAccount.upsert({
    where: { platform_externalAccountId: { platform, externalAccountId } },
    create: { propertyId: property.id, platform, externalAccountId, accountName: name, currency },
    update: { propertyId: property.id, accountName: name, currency },
  });

  console.log(`Linked ${platform} account ${externalAccountId} → ${propertyCode} ("${name}", ${currency}).`);
  console.log(`AdAccount id: ${acc.id}`);
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
