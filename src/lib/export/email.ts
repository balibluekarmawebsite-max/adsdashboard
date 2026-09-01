// The HTML for the emailed reports and reminders. Pure rendering — no database,
// no Prisma — so it can be unit-previewed and reused. Email clients strip
// <style>/classes and choke on flexbox & SVG, so everything here is tables with
// inline styles only, but using the dashboard's colours: tiled KPI blocks,
// favorable/unfavorable delta colouring, and channel bars. A 2-wide KPI grid
// stays readable on phones (a 4-wide grid overflows in Gmail).

import type { ReportModel } from "./report";
import { formatMoney, formatNumber, formatRatioPct, formatRoas, formatDelta } from "@/lib/format";
import { BRAND, deltaArrow, deltaHex, platformHex } from "./theme";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function summaryHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const fmt = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "$1");
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) {
      if (inList) { html += "</ul>"; inList = false; }
      continue;
    }
    if (/^#{1,6}\s/.test(s)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p style="margin:14px 0 4px;font-weight:600;color:${BRAND.ink}">${fmt(s.replace(/^#{1,6}\s*/, ""))}</p>`;
    } else if (/^[-*]\s/.test(s)) {
      if (!inList) { html += `<ul style="margin:4px 0 4px 18px;padding:0;color:#22424e">`; inList = true; }
      html += `<li style="margin:3px 0">${fmt(s.replace(/^[-*]\s*/, ""))}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p style="margin:6px 0;color:#22424e">${fmt(s)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function kpiTile(
  label: string,
  value: string,
  metric: string,
  pct: number | null | undefined,
): string {
  const deltaHtml =
    pct == null
      ? ""
      : `<div style="font-size:11px;font-weight:700;color:${deltaHex(metric, pct)};margin-top:3px">${deltaArrow(pct)} ${esc(formatDelta(Math.abs(pct)))}</div>`;
  return `<td width="50%" valign="top" style="padding:5px">
    <div style="background:${BRAND.tile};border:1px solid ${BRAND.border};border-radius:10px;padding:12px 14px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${BRAND.muted}">${esc(label)}</div>
      <div style="font-size:19px;font-weight:800;color:${BRAND.ink};margin-top:2px">${esc(value)}</div>
      ${deltaHtml}
    </div>
  </td>`;
}

function kpiGridHtml(model: ReportModel): string {
  const cur = model.scope.currency;
  const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, cur));
  const cp = model.kpis.changePct;
  const tiles = [
    kpiTile("Spend", money(model.kpis.spend), "spend", cp.spend),
    kpiTile("Impressions", formatNumber(model.kpis.impressions), "impressions", cp.impressions),
    kpiTile("Clicks", formatNumber(model.kpis.clicks), "clicks", cp.clicks),
    kpiTile("CTR", formatRatioPct(model.kpis.ctr), "ctr", cp.ctr),
    kpiTile("CPC", money(model.kpis.cpc), "cpc", cp.cpc),
    kpiTile("Conversions", formatNumber(model.kpis.conversions), "conversions", cp.conversions),
    kpiTile("ROAS", formatRoas(model.kpis.roas), "roas", cp.roas),
    kpiTile("Revenue", money(model.kpis.revenue), "revenue", cp.revenue),
  ];
  let rows = "";
  for (let i = 0; i < tiles.length; i += 2) rows += `<tr>${tiles[i]}${tiles[i + 1] ?? ""}</tr>`;
  const caption = model.showVariance
    ? `<div style="font-size:11px;color:${BRAND.muted};margin-top:6px">▲▼ % change vs. the previous period · ${model.comparison.from} – ${model.comparison.to}</div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate">${rows}</table>${caption}`;
}

function channelSplitHtml(model: ReportModel): string {
  const cur = model.scope.currency;
  const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, cur));
  const rows = model.platformSplit.filter((p) => p.spend > 0);
  if (rows.length < 2) return "";
  const bars = rows
    .map((p) => {
      const c = platformHex(p.platform);
      const share = Math.max(0, Math.min(100, p.sharePct));
      return `<div style="margin-bottom:12px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${BRAND.ink}"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:6px"></span>${esc(p.label)}</td>
          <td align="right" style="font-size:12px;color:${BRAND.muted}">${esc(money(p.spend))} · ${share.toFixed(0)}%</td>
        </tr></table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.border};border-radius:6px;margin-top:4px"><tr>
          <td style="height:8px;width:${share}%;background:${c};border-radius:6px;font-size:0;line-height:0">&nbsp;</td>
          <td style="width:${100 - share}%;font-size:0;line-height:0">&nbsp;</td>
        </tr></table>
        <div style="font-size:11px;color:${BRAND.muted};margin-top:3px">${esc(formatNumber(p.conversions))} conv · ROAS ${esc(formatRoas(p.roas))}</div>
      </div>`;
    })
    .join("");
  return `<div style="margin-top:22px">
    <div style="font-weight:700;color:${BRAND.ink};font-size:14px;margin-bottom:10px">Channel split</div>
    ${bars}
  </div>`;
}

function breakdownHtml(model: ReportModel): string {
  const cur = model.scope.currency;
  const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, cur));
  const isCampaigns = model.breakdown.kind === "campaigns";
  const rows = model.breakdown.rows.slice(0, 8);
  if (rows.length === 0) return "";
  const th = (t: string, right = false) =>
    `<th align="${right ? "right" : "left"}" style="padding:7px 10px;font-size:11px;font-weight:600;color:#fff;background:${BRAND.navy}">${t}</th>`;
  const header = `<tr>${th(isCampaigns ? "Campaign" : "Property")}${th("Spend", true)}${th("Clicks", true)}${th("Conv.", true)}${th("ROAS", true)}</tr>`;
  const body = rows
    .map((r) => {
      const dot = isCampaigns
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${platformHex(r.platform)};margin-right:6px"></span>`
        : "";
      const name = esc(r.label) + (r.sublabel ? ` <span style="color:${BRAND.muted}">· ${esc(r.sublabel)}</span>` : "");
      const td = (t: string) =>
        `<td align="right" style="padding:7px 10px;font-size:12px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.border}">${t}</td>`;
      return `<tr>
        <td style="padding:7px 10px;font-size:12px;color:${BRAND.ink};border-bottom:1px solid ${BRAND.border}">${dot}${name}</td>
        ${td(esc(money(r.spend)))}${td(esc(formatNumber(r.clicks)))}${td(esc(formatNumber(r.conversions)))}${td(esc(formatRoas(r.roas)))}
      </tr>`;
    })
    .join("");
  return `<div style="margin-top:22px">
    <div style="font-weight:700;color:${BRAND.ink};font-size:14px;margin-bottom:10px">${esc(model.breakdown.title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden">${header}${body}</table>
  </div>`;
}

/** The full performance-report email body (branded, dashboard-styled). */
export function reportEmailHtml(model: ReportModel, summaryText: string | null, link: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:${BRAND.ink};background:#ffffff;padding:4px">
  <div style="border-bottom:3px solid ${BRAND.navy};padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:12px;letter-spacing:2px;color:${BRAND.navy};font-weight:700">BLUE KARMA SECRETS</div>
    <div style="font-size:22px;font-weight:800;margin-top:4px">Ads Performance Report</div>
    <div style="margin-top:6px;color:${BRAND.navy};font-weight:600">${esc(model.scope.propertyLabel)} · ${esc(model.scope.platformLabel)}</div>
    <div style="color:${BRAND.muted};font-size:13px">${model.scope.from} → ${model.scope.to} (${model.scope.days} days)</div>
  </div>
  ${kpiGridHtml(model)}
  ${channelSplitHtml(model)}
  ${summaryText ? `<div style="margin-top:22px"><div style="font-weight:700;color:${BRAND.navy};font-size:14px;margin-bottom:4px">Summary &amp; recommendations</div>${summaryHtml(summaryText)}</div>` : ""}
  ${breakdownHtml(model)}
  <div style="margin-top:24px">
    <a href="${link}" style="background:${BRAND.navy};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">Open the dashboard</a>
  </div>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px">Full figures are attached (Excel &amp; PowerPoint). This is an automated report from the Blue Karma Ads Dashboard.</p>
</div>`;
}

/** The monthly "please submit revenue" reminder email body. */
export function revenueReminderHtml(
  monthName: string,
  year: number,
  missing: { code: string; name: string }[],
  link: string,
): string {
  const list = missing.length
    ? `<ul style="margin:8px 0 0 18px;padding:0;color:#22424e">${missing
        .map((p) => `<li style="margin:3px 0">${esc(p.name)} <span style="color:${BRAND.muted}">(${esc(p.code)})</span></li>`)
        .join("")}</ul>`
    : `<p style="color:${BRAND.positive};margin:8px 0">All properties already have ${monthName} ${year} revenue — nothing outstanding. 🎉</p>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:${BRAND.ink};background:#ffffff;padding:4px">
  <div style="border-bottom:3px solid ${BRAND.navy};padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:12px;letter-spacing:2px;color:${BRAND.navy};font-weight:700">BLUE KARMA SECRETS</div>
    <div style="font-size:22px;font-weight:800;margin-top:4px">Revenue submission reminder</div>
  </div>
  <p style="color:#22424e">Please submit <strong>${monthName} ${year}</strong> revenue so the reports and ROAS are complete.</p>
  <div style="font-weight:600;color:${BRAND.navy};margin-top:12px">Still missing ${monthName} ${year} revenue:</div>
  ${list}
  <div style="margin-top:22px">
    <a href="${link}" style="background:${BRAND.navy};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">Enter revenue</a>
  </div>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px">Automated reminder from the Blue Karma Ads Dashboard.</p>
</div>`;
}
