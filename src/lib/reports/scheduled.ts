import type { ReportSchedule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { systemMetricsFilter } from "@/lib/metrics/query";
import { buildReport, reportSlug, type ReportModel } from "@/lib/export/report";
import { reportToXlsx } from "@/lib/export/xlsx";
import { reportToPptx } from "@/lib/export/pptx";
import { getInsight } from "@/lib/ai/insights";
import { toReportingDateString } from "@/lib/sync/dates";
import { sendMail, parseRecipients } from "@/lib/mail/send";
import { formatMoney, formatNumber, formatRatioPct, formatRoas, formatDelta } from "@/lib/format";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "https://ads.bluekarmasecrets.com"
  ).replace(/\/$/, "");
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** {from,to} (YYYY-MM-DD) for a report window, anchored to today in the reporting TZ. */
export function rangeForPreset(preset: string, now = new Date()): { from: string; to: string } {
  const todayStr = toReportingDateString(now);
  const [y, m, d] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const minus = (n: number) => {
    const x = new Date(today);
    x.setUTCDate(x.getUTCDate() - n);
    return iso(x);
  };
  switch (preset) {
    case "last30":
      return { from: minus(29), to: todayStr };
    case "mtd":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: todayStr };
    case "lastMonth": {
      const lastPrev = new Date(Date.UTC(y, m - 1, 1));
      lastPrev.setUTCDate(0); // last day of previous month
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      return { from: iso(firstPrev), to: iso(lastPrev) };
    }
    case "last7":
    default:
      return { from: minus(6), to: todayStr };
  }
}

// --- HTML email building ---------------------------------------------------

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
      html += `<p style="margin:14px 0 4px;font-weight:600;color:#12333F">${fmt(s.replace(/^#{1,6}\s*/, ""))}</p>`;
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

function reportEmailHtml(model: ReportModel, summaryText: string | null, link: string): string {
  const cur = model.scope.currency;
  const money = (v: number | null) => (v == null ? "—" : formatMoney(v, cur));
  const delta = (k: string) => {
    const p = model.kpis.changePct[k];
    return p == null ? "" : ` <span style="color:#5B7280;font-size:12px">(${formatDelta(p)})</span>`;
  };
  const kpis: [string, string, string][] = [
    ["Spend", money(model.kpis.spend), delta("spend")],
    ["Impressions", formatNumber(model.kpis.impressions), delta("impressions")],
    ["Clicks", formatNumber(model.kpis.clicks), delta("clicks")],
    ["CTR", formatRatioPct(model.kpis.ctr), delta("ctr")],
    ["CPC", money(model.kpis.cpc), delta("cpc")],
    ["ROAS", formatRoas(model.kpis.roas), delta("roas")],
    ["Revenue", money(model.kpis.revenue), ""],
  ];
  const rows = kpis
    .map(
      ([label, value, d]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eef2f4;color:#5B7280;font-size:13px">${label}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #eef2f4;text-align:right;font-weight:600;color:#12333F">${value}${d}</td></tr>`,
    )
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#12333F">
  <div style="border-bottom:3px solid #005A7C;padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:12px;letter-spacing:2px;color:#005A7C;font-weight:700">BLUE KARMA SECRETS</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">Ads Performance Report</div>
    <div style="margin-top:6px;color:#005A7C;font-weight:600">${esc(model.scope.propertyLabel)} · ${esc(model.scope.platformLabel)}</div>
    <div style="color:#5B7280;font-size:13px">${model.scope.from} → ${model.scope.to} (${model.scope.days} days)</div>
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eef2f4;border-radius:8px;overflow:hidden">${rows}</table>
  ${summaryText ? `<div style="margin-top:18px"><div style="font-weight:600;color:#005A7C;margin-bottom:4px">Summary &amp; recommendations</div>${summaryHtml(summaryText)}</div>` : ""}
  <div style="margin-top:22px">
    <a href="${link}" style="background:#005A7C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px">Open the dashboard</a>
  </div>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px">Full figures are attached (Excel &amp; PowerPoint). This is an automated report from the Blue Karma Ads Dashboard.</p>
</div>`;
}

function revenueReminderHtml(
  monthName: string,
  year: number,
  missing: { code: string; name: string }[],
  link: string,
): string {
  const list = missing.length
    ? `<ul style="margin:8px 0 0 18px;padding:0;color:#22424e">${missing
        .map((p) => `<li style="margin:3px 0">${esc(p.name)} <span style="color:#5B7280">(${esc(p.code)})</span></li>`)
        .join("")}</ul>`
    : `<p style="color:#0E9F6E;margin:8px 0">All properties already have ${monthName} ${year} revenue — nothing outstanding. 🎉</p>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#12333F">
  <div style="border-bottom:3px solid #005A7C;padding-bottom:12px;margin-bottom:16px">
    <div style="font-size:12px;letter-spacing:2px;color:#005A7C;font-weight:700">BLUE KARMA SECRETS</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">Revenue submission reminder</div>
  </div>
  <p style="color:#22424e">Please submit <strong>${monthName} ${year}</strong> revenue so the reports and ROAS are complete.</p>
  <div style="font-weight:600;color:#005A7C;margin-top:12px">Still missing ${monthName} ${year} revenue:</div>
  ${list}
  <div style="margin-top:22px">
    <a href="${link}" style="background:#005A7C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px">Enter revenue</a>
  </div>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px">Automated reminder from the Blue Karma Ads Dashboard.</p>
</div>`;
}

// --- Senders ---------------------------------------------------------------

export async function sendScheduledReport(
  schedule: ReportSchedule,
): Promise<{ ok: boolean; error?: string }> {
  const { from, to } = rangeForPreset(schedule.rangePreset);
  const filter = await systemMetricsFilter(from, to, schedule.propertyCode);
  const model = await buildReport(filter);

  // Prefer a cached summary for this exact view; otherwise generate one so the
  // owner gets the narrative in the email (once per send — fine for weekly).
  let summaryText = model.aiSummary;
  if (!summaryText) {
    try {
      const ins = await getInsight(filter, "en");
      summaryText = ins.summaryText;
    } catch {
      summaryText = null;
    }
  }

  const slug = reportSlug(model);
  const link = `${appUrl()}/report?from=${from}&to=${to}${schedule.propertyCode ? `&property=${encodeURIComponent(schedule.propertyCode)}` : ""}`;
  const html = reportEmailHtml(model, summaryText, link);
  const subject = `Ads report · ${model.scope.propertyLabel} · ${model.scope.from} – ${model.scope.to}`;

  const attachments = [
    { filename: `ads-report_${slug}.xlsx`, content: reportToXlsx(model), contentType: XLSX_TYPE },
    { filename: `ads-report_${slug}.pptx`, content: await reportToPptx(model), contentType: PPTX_TYPE },
  ];

  return sendMail({ to: parseRecipients(schedule.recipients), subject, html, attachments });
}

export async function sendRevenueReminder(
  schedule: ReportSchedule,
): Promise<{ ok: boolean; error?: string }> {
  // Last calendar month, in the reporting timezone.
  const [y, m] = toReportingDateString(new Date()).split("-").map(Number);
  const lastPrev = new Date(Date.UTC(y, m - 1, 1));
  lastPrev.setUTCDate(0);
  const year = lastPrev.getUTCFullYear();
  const month = lastPrev.getUTCMonth() + 1;

  const [props, have] = await Promise.all([
    prisma.property.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    prisma.revenueMonthly.findMany({ where: { year, month }, select: { propertyId: true } }),
  ]);
  const haveSet = new Set(have.map((h) => h.propertyId));
  const missing = props.filter((p) => !haveSet.has(p.id)).map((p) => ({ code: p.code, name: p.name }));

  const monthName = MONTHS[month - 1];
  const link = `${appUrl()}/dashboard/revenue`;
  const html = revenueReminderHtml(monthName, year, missing, link);
  const subject = `Reminder: submit ${monthName} ${year} revenue`;

  // Explicit recipients, or fall back to all Owners/Admins.
  let recipients = parseRecipients(schedule.recipients);
  if (recipients.length === 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN"] } },
      select: { email: true },
    });
    recipients = admins.map((a) => a.email);
  }

  return sendMail({ to: recipients, subject, html });
}

export async function runSchedule(schedule: ReportSchedule): Promise<{ ok: boolean; error?: string }> {
  return schedule.kind === "revenue_reminder"
    ? sendRevenueReminder(schedule)
    : sendScheduledReport(schedule);
}
