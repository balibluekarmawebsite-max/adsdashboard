import "dotenv/config";
import { getMetaConfig, resolveMetaToken } from "@/lib/meta/config";

// Lists the ad accounts the Meta token can read — confirms the token works and
// shows the act_ id + currency to hand to `npm run link:account`.
async function main() {
  const { apiVersion } = getMetaConfig();
  const token = await resolveMetaToken();
  const url =
    `https://graph.facebook.com/${apiVersion}/me/adaccounts` +
    `?fields=name,account_id,currency,account_status&limit=200&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: Array<{ name?: string; account_id?: string; currency?: string; account_status?: number }>;
    error?: { message?: string; code?: number };
  };

  if (json.error) {
    console.error(`Meta API error (code ${json.error.code}): ${json.error.message}`);
    console.error("If it's a permissions error, re-check the token has ads_read and the ad account is assigned to the system user.");
    process.exit(1);
  }

  const accounts = json.data ?? [];
  if (accounts.length === 0) {
    console.log("Token works, but no ad accounts are visible to it.");
    console.log("Assign the ad account to the system user (View Performance) in Meta Business Settings, then re-run.");
    return;
  }

  console.log(`Ad accounts this token can read (${accounts.length}):\n`);
  for (const a of accounts) {
    const status = a.account_status === 1 ? "active" : `status ${a.account_status ?? "?"}`;
    console.log(`  act_${a.account_id}   ${(a.currency ?? "?").padEnd(4)} ${status.padEnd(10)} ${a.name ?? ""}`);
  }
  console.log(
    `\nLink one with, e.g.:\n  npm run link:account -- --platform meta --property BKDS --account act_<id> --name "<label>" --currency <cur>`,
  );
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
