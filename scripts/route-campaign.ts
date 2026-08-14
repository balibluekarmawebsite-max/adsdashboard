import "dotenv/config";
import { prisma } from "@/lib/db";

// Route campaigns within a shared ad account to properties by matching the
// campaign name. Campaigns that match no route are ignored by the sync.
//
//   npm run route:campaign -- --account act_123 --match BKDU --property BKDU
//   npm run route:campaign -- --account act_123 --match BKV  --property BKV
//   npm run route:campaign -- --account act_123 --match BKDS --property BKDS
//   npm run route:campaign -- --list
//   npm run route:campaign -- --remove <routeId>

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function digits(s: string): string {
  return s.replace(/^act_/i, "").replace(/[^0-9]/g, "");
}

async function list() {
  const routes = await prisma.campaignRoute.findMany({
    include: {
      adAccount: { select: { platform: true, externalAccountId: true } },
      property: { select: { code: true } },
    },
    orderBy: [{ adAccountId: "asc" }, { priority: "desc" }],
  });
  if (routes.length === 0) {
    console.log("No campaign routes yet.");
    return;
  }
  for (const r of routes) {
    const m = r.isRegex ? `/${r.pattern}/i` : `"${r.pattern}"`;
    console.log(
      `${r.id}  ${r.adAccount.platform.padEnd(6)} ${r.adAccount.externalAccountId.padEnd(15)} p${r.priority}  ${m} → ${r.property.code}`,
    );
  }
}

async function main() {
  if (process.argv.includes("--list")) return list();

  const removeId = arg("remove");
  if (removeId) {
    await prisma.campaignRoute.delete({ where: { id: removeId } });
    console.log(`Removed route ${removeId}.`);
    return;
  }

  const platform = arg("platform");
  const accountRaw = arg("account");
  const match = arg("match");
  const propertyCode = arg("property");
  const priority = Number(arg("priority") ?? "0");
  const isRegex = process.argv.includes("--regex");

  const usage =
    'Usage:\n  npm run route:campaign -- --account <id> --match "<text>" --property <CODE> [--platform meta|google] [--priority N] [--regex]\n  npm run route:campaign -- --list\n  npm run route:campaign -- --remove <routeId>';

  if (!accountRaw || !match || !propertyCode) throw new Error(usage);
  if (!Number.isFinite(priority)) throw new Error("--priority must be a number.");

  const externalAccountId = digits(accountRaw);
  const accounts = await prisma.adAccount.findMany({
    where:
      platform === "meta" || platform === "google"
        ? { platform, externalAccountId }
        : { externalAccountId },
  });
  if (accounts.length === 0) {
    throw new Error(`No linked ad account "${externalAccountId}". Run \`npm run link:account\` first.`);
  }
  if (accounts.length > 1) {
    throw new Error(`Account ${externalAccountId} exists for multiple platforms — add --platform meta|google.`);
  }
  const account = accounts[0];

  const property = await prisma.property.findUnique({ where: { code: propertyCode } });
  if (!property) throw new Error(`No property with code "${propertyCode}".`);

  const route = await prisma.campaignRoute.create({
    data: { adAccountId: account.id, pattern: match, isRegex, propertyId: property.id, priority },
  });
  const m = isRegex ? `/${match}/i` : `"${match}"`;
  console.log(
    `Route added: ${account.platform} ${externalAccountId} — campaigns matching ${m} → ${propertyCode} (priority ${priority}).`,
  );
  console.log(`Route id: ${route.id}`);
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
