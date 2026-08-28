import pptxgen from "pptxgenjs";
import type { ReportModel } from "./report";
import { formatMoney, formatNumber, formatRatioPct, formatRoas } from "@/lib/format";
import { BRAND, deltaArrow, deltaHex, platformHex, pptxColor } from "./theme";

// A branded slide deck for the current report view, styled to match the live
// dashboard (same navy, same favorable/unfavorable delta colours, same channel
// split). Pure JS (pptxgenjs) — no native deps, so it runs on the server.

const NAVY = pptxColor(BRAND.navy);
const INK = pptxColor(BRAND.ink);
const MUTED = pptxColor(BRAND.muted);
const TILE = pptxColor(BRAND.tile);
const LINE = pptxColor(BRAND.border);
const SOFT = pptxColor(BRAND.accent);
const WHITE = "FFFFFF";

const SLIDE_W = 13.333;

function deltaText(pct: number | null | undefined): string {
  if (pct == null) return "";
  return `${deltaArrow(pct)} ${Math.abs(pct).toFixed(1)}% vs prev`;
}

function stripMarkdown(md: string): string {
  return md
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\s*[-*]\s+/, "•  ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1"),
    )
    .join("\n");
}

function headerBar(slide: pptxgen.Slide, pptx: pptxgen, title: string) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.9, fill: { color: NAVY } });
  slide.addText(title, {
    x: 0.55,
    y: 0,
    w: 9,
    h: 0.9,
    fontSize: 20,
    bold: true,
    color: WHITE,
    valign: "middle",
  });
  slide.addText("BLUE KARMA SECRETS", {
    x: 9.5,
    y: 0,
    w: 3.28,
    h: 0.9,
    fontSize: 11,
    color: SOFT,
    align: "right",
    valign: "middle",
    charSpacing: 1,
  });
}

export async function reportToPptx(model: ReportModel): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 × 7.5in
  pptx.author = "Blue Karma Secrets Ads Dashboard";
  pptx.company = "Blue Karma Secrets";
  pptx.title = "Ads Performance Report";

  const cur = model.scope.currency;
  // Full numbers (no M/K), matching the dashboard.
  const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, cur));

  // --- Slide 1: title ---
  const title = pptx.addSlide();
  title.background = { color: WHITE };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: NAVY } });
  title.addText(
    [
      { text: "BLUE KARMA ", options: { bold: true } },
      { text: "SECRETS", options: { bold: false, charSpacing: 2 } },
    ],
    { x: 0.9, y: 1.5, w: 11, h: 0.6, fontSize: 24, color: NAVY },
  );
  title.addText("Ads Performance Report", {
    x: 0.9,
    y: 2.5,
    w: 11.5,
    h: 1,
    fontSize: 40,
    bold: true,
    color: INK,
  });
  title.addText(
    [
      { text: model.scope.propertyLabel, options: { bold: true, color: NAVY } },
      { text: `   ·   ${model.scope.platformLabel}`, options: { color: MUTED } },
    ],
    { x: 0.9, y: 3.7, w: 11.5, h: 0.5, fontSize: 18 },
  );
  title.addText(`${model.scope.from} → ${model.scope.to}  (${model.scope.days} days)`, {
    x: 0.9,
    y: 4.25,
    w: 11.5,
    h: 0.4,
    fontSize: 14,
    color: MUTED,
  });
  title.addText(`Generated ${new Date(model.scope.generatedAt).toLocaleString("en-US")}`, {
    x: 0.9,
    y: 6.7,
    w: 11.5,
    h: 0.4,
    fontSize: 10,
    color: MUTED,
  });

  // --- Slide 2: KPI tiles (delta coloured by whether the change is favorable) ---
  const kpi = pptx.addSlide();
  kpi.background = { color: WHITE };
  headerBar(kpi, pptx, "Key metrics");
  const tiles: { label: string; value: string; metric: string; pct: number | null }[] = [
    { label: "Spend", value: money(model.kpis.spend), metric: "spend", pct: model.kpis.changePct.spend ?? null },
    { label: "Impressions", value: formatNumber(model.kpis.impressions), metric: "impressions", pct: model.kpis.changePct.impressions ?? null },
    { label: "Clicks", value: formatNumber(model.kpis.clicks), metric: "clicks", pct: model.kpis.changePct.clicks ?? null },
    { label: "CTR", value: formatRatioPct(model.kpis.ctr), metric: "ctr", pct: model.kpis.changePct.ctr ?? null },
    { label: "CPC", value: money(model.kpis.cpc), metric: "cpc", pct: model.kpis.changePct.cpc ?? null },
    { label: "Conversions", value: formatNumber(model.kpis.conversions), metric: "conversions", pct: model.kpis.changePct.conversions ?? null },
    { label: "ROAS", value: formatRoas(model.kpis.roas), metric: "roas", pct: model.kpis.changePct.roas ?? null },
    { label: "Revenue", value: money(model.kpis.revenue), metric: "revenue", pct: model.kpis.changePct.revenue ?? null },
  ];
  const cols = 4;
  const tW = 2.93;
  const tH = 2.15;
  const gap = 0.3;
  const startX = (SLIDE_W - (cols * tW + (cols - 1) * gap)) / 2;
  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (tW + gap);
    const y = 1.3 + row * (tH + gap);
    kpi.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: tW,
      h: tH,
      rectRadius: 0.08,
      fill: { color: TILE },
      line: { color: LINE, width: 0.75 },
    });
    kpi.addText(t.label.toUpperCase(), {
      x: x + 0.2,
      y: y + 0.2,
      w: tW - 0.4,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: MUTED,
      charSpacing: 1,
    });
    kpi.addText(t.value, {
      x: x + 0.2,
      y: y + 0.6,
      w: tW - 0.4,
      h: 0.85,
      fontSize: 21,
      bold: true,
      color: INK,
      fit: "shrink",
    });
    const dt = deltaText(t.pct);
    if (dt) {
      kpi.addText(dt, {
        x: x + 0.2,
        y: y + tH - 0.5,
        w: tW - 0.4,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: pptxColor(deltaHex(t.metric, t.pct)),
      });
    }
  });
  if (model.showVariance) {
    kpi.addText(
      `▲▼ % change vs. the previous period · ${model.comparison.from} – ${model.comparison.to}`,
      { x: startX, y: 6.55, w: 12, h: 0.35, fontSize: 10, color: MUTED },
    );
  }

  // --- Slide 3: spend over time ---
  if (model.series.length > 1) {
    const trend = pptx.addSlide();
    trend.background = { color: WHITE };
    headerBar(trend, pptx, "Spend over time");
    trend.addChart(
      pptx.ChartType.area,
      [
        {
          name: "Spend",
          labels: model.series.map((s) => s.date),
          values: model.series.map((s) => s.spend),
        },
      ],
      {
        x: 0.5,
        y: 1.25,
        w: 12.33,
        h: 5.7,
        chartColors: [NAVY],
        chartColorsOpacity: 22,
        lineSize: 2.5,
        lineSmooth: true,
        showLegend: false,
        showTitle: false,
        catAxisLabelFontSize: 8,
        catAxisLabelColor: MUTED,
        valAxisLabelFontSize: 9,
        valAxisLabelColor: MUTED,
        valGridLine: { style: "solid", color: "EDEDED", size: 1 },
        catGridLine: { style: "none" },
      },
    );
  }

  // --- Slide 4: channel split (Google vs Meta), when there are 2+ channels ---
  const channels = model.platformSplit.filter((p) => p.spend > 0);
  if (channels.length >= 2) {
    const cs = pptx.addSlide();
    cs.background = { color: WHITE };
    headerBar(cs, pptx, "Channel split");
    const trackW = 12.1;
    let y = 1.6;
    channels.forEach((p) => {
      const c = pptxColor(platformHex(p.platform));
      const share = Math.max(0, Math.min(100, p.sharePct));
      cs.addText(
        [
          { text: "● ", options: { color: c } },
          { text: p.label, options: { bold: true, color: INK } },
        ],
        { x: 0.6, y, w: 7, h: 0.4, fontSize: 16, valign: "middle" },
      );
      cs.addText(`${money(p.spend)}   ·   ${share.toFixed(0)}%`, {
        x: 6.7,
        y,
        w: 6,
        h: 0.4,
        fontSize: 14,
        color: MUTED,
        align: "right",
        valign: "middle",
      });
      y += 0.5;
      cs.addShape(pptx.ShapeType.roundRect, {
        x: 0.6,
        y,
        w: trackW,
        h: 0.32,
        rectRadius: 0.16,
        fill: { color: LINE },
      });
      cs.addShape(pptx.ShapeType.roundRect, {
        x: 0.6,
        y,
        w: Math.max(0.12, (trackW * share) / 100),
        h: 0.32,
        rectRadius: 0.16,
        fill: { color: c },
      });
      y += 0.5;
      cs.addText(`${formatNumber(p.conversions)} conv    ·    ROAS ${formatRoas(p.roas)}`, {
        x: 0.6,
        y,
        w: trackW,
        h: 0.35,
        fontSize: 11,
        color: MUTED,
      });
      y += 0.85;
    });
  }

  // --- Slide 5: breakdown table ---
  const isCampaigns = model.breakdown.kind === "campaigns";
  const table = pptx.addSlide();
  table.background = { color: WHITE };
  headerBar(table, pptx, model.breakdown.title);

  const head = isCampaigns
    ? ["Campaign", "Platform", "Spend", "Clicks", "Conv.", "ROAS"]
    : ["Hotel", "Spend", "Impressions", "Clicks", "Conv.", "ROAS", "Revenue"];
  const headRow = head.map((h) => ({
    text: h,
    options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, align: "left" as const },
  }));
  const bodyRows = model.breakdown.rows.slice(0, 12).map((r) => {
    const cells = isCampaigns
      ? [r.label, (r.platform ?? "").replace(/^\w/, (m) => m.toUpperCase()), money(r.spend), formatNumber(r.clicks), formatNumber(r.conversions), formatRoas(r.roas)]
      : [r.label, money(r.spend), formatNumber(r.impressions), formatNumber(r.clicks), formatNumber(r.conversions), formatRoas(r.roas), money(r.revenue)];
    return cells.map((text) => ({
      text,
      options: { color: INK, fontSize: 10, align: "left" as const },
    }));
  });
  const colW = isCampaigns
    ? [5.2, 1.6, 1.7, 1.3, 1.3, 1.23]
    : [3.6, 1.7, 1.9, 1.5, 1.3, 1.1, 1.23];
  table.addTable([headRow, ...bodyRows], {
    x: 0.5,
    y: 1.25,
    w: 12.33,
    colW,
    border: { type: "solid", color: LINE, pt: 0.5 },
    align: "left",
    valign: "middle",
    rowH: 0.42,
    fill: { color: WHITE },
    autoPage: false,
  });

  // --- Slide 6: AI summary (only if one exists for this view) ---
  if (model.aiSummary) {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    headerBar(s, pptx, "Summary & recommendations");
    s.addText(stripMarkdown(model.aiSummary), {
      x: 0.6,
      y: 1.25,
      w: 12.13,
      h: 5.9,
      fontSize: 14,
      color: INK,
      lineSpacingMultiple: 1.3,
      valign: "top",
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
