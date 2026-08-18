import "dotenv/config";
import { getMetaConfig, resolveMetaToken, normalizeMetaAccountId } from "@/lib/meta/config";
import { prisma } from "@/lib/db";

// Lists the conversion "action_type" values Meta actually reports for the linked
// ad account, so META_CONVERSION_ACTIONS can be set to the right event(s).
//   npm run meta:actions [days]   (default 30)
async function main() {
  const { apiVersion } = getMetaConfig();
  const token = await resolveMetaToken();

  const account = await prisma.adAccount.findFirst({ where: { platform: "meta" } });
  if (!account) {
    console.error("No Meta ad account linked yet. Run `npm run link:account` first.");
    process.exit(1);
  }
  const acct = normalizeMetaAccountId(account.externalAccountId);

  const days = Number(process.argv[2] ?? 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const range = { since: fmt(new Date(Date.now() - days * 86_400_000)), until: fmt(new Date()) };
  const url =
    `https://graph.facebook.com/${apiVersion}/act_${acct}/insights` +
    `?level=account&time_range=${encodeURIComponent(JSON.stringify(range))}` +
    `&fields=actions,action_values&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: Array<{
      actions?: Array<{ action_type: string; value?: string }>;
      action_values?: Array<{ action_type: string; value?: string }>;
    }>;
    error?: { message?: string; code?: number };
  };
  if (json.error) {
    console.error(`Meta API error (code ${json.error.code}): ${json.error.message}`);
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  const values: Record<string, number> = {};
  for (const row of json.data ?? []) {
    for (const a of row.actions ?? []) counts[a.action_type] = (counts[a.action_type] ?? 0) + Number(a.value ?? 0);
    for (const a of row.action_values ?? [])
      values[a.action_type] = (values[a.action_type] ?? 0) + Number(a.value ?? 0);
  }

  const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (types.length === 0) {
    console.log(`No conversion actions reported for act_${acct} in the last ${days} days.`);
    console.log("If you expect conversions, check the window (try a larger [days]) or that the Pixel/CAPI is firing.");
    return;
  }

  console.log(`Conversion action types for act_${acct}, last ${days} days:\n`);
  console.log("count        value(IDR)   action_type");
  for (const t of types) {
    console.log(`${String(counts[t]).padStart(8)}   ${String(Math.round(values[t] ?? 0)).padStart(12)}   ${t}`);
  }
  console.log('\nPick the one(s) that mean "a booking" and set e.g.:');
  console.log('  META_CONVERSION_ACTIONS="offsite_conversion.fb_pixel_purchase,purchase"');
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
