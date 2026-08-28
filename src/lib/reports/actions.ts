"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { asRole, canManageReports } from "@/lib/rbac";
import { parseRecipients } from "@/lib/mail/send";
import { runSchedule } from "@/lib/reports/scheduled";
import { setShowVariance } from "@/lib/settings";
import type { ReportKind, ReportFrequency } from "@/generated/prisma/client";

export type ScheduleActionState = { error?: string; success?: string } | undefined;

async function requireManager(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user && canManageReports(asRole(session.user.role)));
}

const KINDS = ["report", "revenue_reminder"] as const;
const FREQS = ["weekly", "monthly"] as const;
const PRESETS = ["last7", "last30", "lastMonth", "mtd"] as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function createSchedule(
  _prev: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  if (!(await requireManager())) return { error: "You are not allowed to manage reports." };

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "report") as ReportKind;
  const frequency = String(formData.get("frequency") ?? "weekly") as ReportFrequency;
  const rangePreset = String(formData.get("rangePreset") ?? "last7");
  const propertyCodeRaw = String(formData.get("propertyCode") ?? "all");
  const recipientsRaw = String(formData.get("recipients") ?? "");

  if (!name) return { error: "Give the schedule a name." };
  if (!KINDS.includes(kind)) return { error: "Invalid type." };
  if (!FREQS.includes(frequency)) return { error: "Invalid frequency." };
  if (kind === "report" && !PRESETS.includes(rangePreset as (typeof PRESETS)[number])) {
    return { error: "Invalid report range." };
  }

  const hour = clampInt(formData.get("hour"), 0, 23, 8);
  const minute = clampInt(formData.get("minute"), 0, 59, 0);
  const dayOfWeek = frequency === "weekly" ? clampInt(formData.get("dayOfWeek"), 0, 6, 1) : null;
  const dayOfMonth = frequency === "monthly" ? clampInt(formData.get("dayOfMonth"), 1, 28, 1) : null;

  const recipients = parseRecipients(recipientsRaw);
  if (kind === "report" && recipients.length === 0) {
    return { error: "Add at least one recipient email for a report." };
  }

  await prisma.reportSchedule.create({
    data: {
      name,
      kind,
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      rangePreset: kind === "report" ? rangePreset : "lastMonth",
      propertyCode: kind === "report" && propertyCodeRaw !== "all" ? propertyCodeRaw : null,
      recipients: recipients.join(", "),
    },
  });

  revalidatePath("/dashboard/reports");
  return { success: `Schedule "${name}" created.` };
}

export async function setScheduleEnabled(id: string, enabled: boolean): Promise<ScheduleActionState> {
  if (!(await requireManager())) return { error: "Not allowed." };
  await prisma.reportSchedule.update({ where: { id }, data: { enabled } });
  revalidatePath("/dashboard/reports");
  return { success: enabled ? "Enabled." : "Paused." };
}

export async function deleteSchedule(id: string): Promise<ScheduleActionState> {
  if (!(await requireManager())) return { error: "Not allowed." };
  await prisma.reportSchedule.delete({ where: { id } });
  revalidatePath("/dashboard/reports");
  return { success: "Schedule removed." };
}

/** Global toggle: show or hide the period-over-period variance % everywhere. */
export async function setReportVariance(on: boolean): Promise<ScheduleActionState> {
  if (!(await requireManager())) return { error: "Not allowed." };
  await setShowVariance(on);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
  return { success: on ? "Variance is now shown on reports." : "Variance is now hidden on reports." };
}

/** Fire a schedule immediately (a test send / on-demand). */
export async function sendScheduleNow(id: string): Promise<ScheduleActionState> {
  if (!(await requireManager())) return { error: "Not allowed." };
  const schedule = await prisma.reportSchedule.findUnique({ where: { id } });
  if (!schedule) return { error: "Schedule not found." };
  const res = await runSchedule(schedule);
  if (!res.ok) return { error: res.error ?? "Send failed." };
  await prisma.reportSchedule.update({ where: { id }, data: { lastSentAt: new Date() } });
  revalidatePath("/dashboard/reports");
  return { success: "Sent now." };
}
