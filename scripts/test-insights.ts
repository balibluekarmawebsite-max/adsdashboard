import "dotenv/config";
import { prisma } from "@/lib/db";
import { parseMetricsParams } from "@/lib/metrics/query";
import { buildSnapshot } from "@/lib/ai/snapshot";
import { generateSummary } from "@/lib/ai/groq";
import { isLanguage, type InsightLanguage } from "@/lib/ai/prompt";

// Preview the AI insights end-to-end without any UI. Prints the exact snapshot
// we send to Groq, then (if GROQ_API_KEY is set) the generated summary in EN + ID.
//
//   npm run insights:test
//   npm run insights:test -- --from 2026-05-21 --to 2026-08-18 --property BKDS --lang en

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const to = arg("to") ?? ymd(new Date());
  const from = arg("from") ?? ymd(new Date(Date.now() - 29 * 86_400_000));
  const property = arg("property") ?? "all";
  const platform = arg("platform") ?? "all";
  const langArg = arg("lang");
  const langs: InsightLanguage[] = langArg && isLanguage(langArg) ? [langArg] : ["en", "id"];

  const sp = new URLSearchParams({ from, to });
  if (property !== "all") sp.set("property", property);
  if (platform !== "all") sp.set("platform", platform);
  const filter = await parseMetricsParams(sp);

  const { snapshot, dataSignature, isEmpty } = await buildSnapshot(filter);
  console.log("\n===== SNAPSHOT (exactly what we send to Groq) =====");
  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\ndataSignature: ${dataSignature}   isEmpty: ${isEmpty}`);

  if (isEmpty) {
    console.log("\n(No spend in this view — nothing to summarize. Try a wider range or --platform meta.)");
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    console.log("\nGROQ_API_KEY not set — snapshot shown above. Add the key to .env to generate the summary.");
    return;
  }

  for (const lang of langs) {
    console.log(`\n===== SUMMARY (${lang}) =====`);
    const { text, model, tokenUsage } = await generateSummary(snapshot, lang);
    console.log(text);
    console.log(`\n[model: ${model}, tokens: ${tokenUsage}]`);
  }
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
