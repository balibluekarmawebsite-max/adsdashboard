import type { ReportSchedule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { systemMetricsFilter } from "@/lib/metrics/query";
import { buildReport, reportSlug } from "@/lib/export/report";
import { reportToXlsx } from "@/lib/export/xlsx";
import { reportToPptx } from "@/lib/export/pptx";
import { getInsight } from "@/lib/ai/insights";
import { toReportingDateString } from "@/lib/sync/dates";
import { sendMail, parseRecipients } from "@/lib/mail/send";
import { reportEmailHtml, revenueReminderHtml } from "@/lib/export/email";

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
