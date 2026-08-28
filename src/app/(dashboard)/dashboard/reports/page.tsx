import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asRole, canManageReports } from "@/lib/rbac";
import { listPropertyOptions } from "@/lib/properties.server";
import { mailConfigured } from "@/lib/mail/send";
import { getShowVariance } from "@/lib/settings";
import { ReportScheduler, type ScheduleRow } from "@/components/dashboard/report-scheduler";
import { VarianceToggle } from "@/components/dashboard/variance-toggle";

export const metadata = { title: "Reports · Ads Dashboard" };

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageReports(asRole(session.user.role))) redirect("/dashboard");

  const [schedules, properties, showVariance] = await Promise.all([
    prisma.reportSchedule.findMany({ orderBy: { createdAt: "asc" } }),
    listPropertyOptions(),
    getShowVariance(),
  ]);

  const rows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    enabled: s.enabled,
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek,
    dayOfMonth: s.dayOfMonth,
    hour: s.hour,
    minute: s.minute,
    rangePreset: s.rangePreset,
    propertyCode: s.propertyCode,
    recipients: s.recipients,
    lastSentAt: s.lastSentAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <VarianceToggle initial={showVariance} />
      <ReportScheduler mailReady={mailConfigured()} properties={properties} schedules={rows} />
    </div>
  );
}
