import * as XLSX from "xlsx";
import type { ReportModel } from "./report";

// Build a multi-sheet workbook (Summary / Breakdown / Daily) from a report.
// Numbers are written raw so the figures stay usable in Excel; CTR is expressed
// as a percentage number and ROAS as a plain multiple.

const pct = (v: number | null | undefined) => (v == null ? "" : Number((v * 100).toFixed(2)));
const n = (v: number | null | undefined) => (v == null ? "" : Number(v));

export function reportToXlsx(model: ReportModel): Buffer {
  const wb = XLSX.utils.book_new();
  const cur = model.scope.currency ?? "mixed";
  const cp = model.kpis.changePct;
  // The variance column only appears when the global "show variance" setting is on.
  const v = model.showVariance;
  const metricRow = (label: string, value: string | number, change: number | null | undefined) =>
    v ? [label, value, n(change)] : [label, value];

  // --- Summary ---
  const summaryAoa: (string | number)[][] = [
    ["Blue Karma Secrets — Ads Performance Report"],
    [],
    ["Scope", model.scope.propertyLabel],
    ["Platform", model.scope.platformLabel],
    ["Period", `${model.scope.from} → ${model.scope.to} (${model.scope.days} days)`],
    ["Currency", cur],
    ["Generated", new Date(model.scope.generatedAt).toLocaleString("en-US")],
    [],
    v ? ["Metric", `Value (${cur})`, "Change vs prev period (%)"] : ["Metric", `Value (${cur})`],
    metricRow("Spend", n(model.kpis.spend), cp.spend),
    metricRow("Impressions", n(model.kpis.impressions), cp.impressions),
    metricRow("Clicks", n(model.kpis.clicks), cp.clicks),
    metricRow("CTR (%)", pct(model.kpis.ctr), cp.ctr),
    metricRow("CPC", n(model.kpis.cpc), cp.cpc),
    metricRow("Conversions", n(model.kpis.conversions), cp.conversions),
    metricRow("ROAS (×)", n(model.kpis.roas), cp.roas),
    metricRow("Revenue", n(model.kpis.revenue), cp.revenue),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryAoa);
  ws1["!cols"] = v ? [{ wch: 22 }, { wch: 26 }, { wch: 24 }] : [{ wch: 22 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  // --- Breakdown (units or campaigns) ---
  const isCampaigns = model.breakdown.kind === "campaigns";
  const header = isCampaigns
    ? ["Campaign", "Platform", "Spend", "Impressions", "Clicks", "CTR (%)", "Conversions", "ROAS (×)"]
    : ["Property", "Code", "Spend", "Impressions", "Clicks", "CTR (%)", "Conversions", "ROAS (×)", "Revenue"];
  const rows = model.breakdown.rows.map((r) =>
    isCampaigns
      ? [r.label, r.platform ?? "", n(r.spend), n(r.impressions), n(r.clicks), pct(r.ctr), n(r.conversions), n(r.roas)]
      : [
          r.label,
          r.sublabel ?? "",
          n(r.spend),
          n(r.impressions),
          n(r.clicks),
          pct(r.ctr),
          n(r.conversions),
          n(r.roas),
          n(r.revenue),
        ],
  );
  const ws2 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws2["!cols"] = header.map((h, i) => ({ wch: i === 0 ? 42 : 14 }));
  XLSX.utils.book_append_sheet(wb, ws2, isCampaigns ? "Campaigns" : "By hotel");

  // --- Daily ---
  const dHeader = ["Date", "Spend", "Impressions", "Clicks", "Conversions"];
  const dRows = model.series.map((s) => [s.date, n(s.spend), n(s.impressions), n(s.clicks), n(s.conversions)]);
  const ws3 = XLSX.utils.aoa_to_sheet([dHeader, ...dRows]);
  ws3["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Daily");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
