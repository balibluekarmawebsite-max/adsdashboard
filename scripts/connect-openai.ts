import "dotenv/config";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getOpenAiAdsConfig } from "@/lib/openai/config";
import { fetchAdAccount } from "@/lib/openai/connector";

// Connect an OpenAI (ChatGPT) Ads account:
//   1. verify OPENAI_ADS_API_KEY against GET /v1/ad_account (confirms the key),
//   2. store the key ENCRYPTED in platform_connections (so it leaves the env),
//   3. link the discovered ad account to a property (creates the AdAccount row
//      the sync engine reads).
//
//   npm run connect:openai -- --property BKDS
//   npm run connect:openai -- --property BKDS --name "Blue Karma · ChatGPT Ads"
//
// The OpenAI key is scoped to ONE ad account; its id and currency come from the
// API, so you don't pass them. Re-run any time to rotate the key or re-point it.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = process.env.OPENAI_ADS_API_KEY;
  if (!key) throw new Error("Set OPENAI_ADS_API_KEY in .env first (your Ads Manager API key).");

  const propertyCode = arg("property");
  if (!propertyCode) {
    throw new Error(
      'Usage: npm run connect:openai -- --property <CODE> [--name "<label>"]\n' +
        "<CODE> is the property to attribute spend to (e.g. BKDS). Campaign-name routing still applies.",
    );
  }

  const property = await prisma.property.findUnique({ where: { code: propertyCode } });
  if (!property) throw new Error(`No property with code "${propertyCode}". Run \`npm run db:seed\` first.`);

  // 1) Verify the key + discover the account (id, currency, timezone).
  const cfg = getOpenAiAdsConfig();
  console.log(`Verifying key against ${cfg.baseUrl}/ad_account …`);
  const account = await fetchAdAccount(cfg, key);
  const currency = (account.currency || arg("currency") || "IDR").toUpperCase();
  if (currency.length !== 3) throw new Error(`Account currency "${currency}" is not a 3-letter ISO code.`);
  const name = arg("name") ?? `${property.code} · OpenAI (${account.name})`;
  console.log(
    `Account OK: id=${account.id} currency=${currency}` +
      (account.timezone ? ` tz=${account.timezone}` : "") +
      (account.status ? ` status=${account.status}` : ""),
  );

  // 2) Store the key encrypted (so the raw key no longer has to live in the env).
  await prisma.platformConnection.upsert({
    where: { platform_accountRef: { platform: "openai", accountRef: `openai:${account.id}` } },
    create: {
      platform: "openai",
      accountRef: `openai:${account.id}`,
      secretEncrypted: encryptSecret(key),
      status: "active",
    },
    update: { secretEncrypted: encryptSecret(key), status: "active" },
  });

  // 3) Link the ad account to the property.
  const acc = await prisma.adAccount.upsert({
    where: { platform_externalAccountId: { platform: "openai", externalAccountId: account.id } },
    create: {
      propertyId: property.id,
      platform: "openai",
      externalAccountId: account.id,
      accountName: name,
      currency,
    },
    update: { propertyId: property.id, accountName: name, currency },
  });

  console.log(`\nConnected OpenAI Ads account ${account.id} → ${property.code} ("${name}", ${currency}).`);
  console.log(`AdAccount id: ${acc.id}`);
  console.log("Key stored encrypted in platform_connections. Now run: npm run sync:all");
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
