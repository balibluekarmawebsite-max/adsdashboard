"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send, Trash2, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PropertyOption } from "@/lib/properties";
import { PropertyOptions } from "./property-options";
import {
  createSchedule,
  deleteSchedule,
  sendScheduleNow,
  setScheduleEnabled,
  type ScheduleActionState,
} from "@/lib/reports/actions";

export interface ScheduleRow {
  id: string;
  name: string;
  kind: "report" | "revenue_reminder";
  enabled: boolean;
  frequency: "weekly" | "monthly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  minute: number;
  rangePreset: string;
  propertyCode: string | null;
  recipients: string;
  lastSentAt: string | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PRESET_LABEL: Record<string, string> = {
  last7: "Last 7 days",
  last30: "Last 30 days",
  lastMonth: "Last calendar month",
  mtd: "Month to date",
};
const field =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none";

function describe(s: ScheduleRow): string {
  const time = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
  const when =
    s.frequency === "weekly"
      ? `Weekly · ${WEEKDAYS[s.dayOfWeek ?? 1]}`
      : `Monthly · day ${s.dayOfMonth ?? 1}`;
  return `${when} · ${time}`;
}

export function ReportScheduler({
  mailReady,
  properties,
  schedules,
}: {
  mailReady: boolean;
  properties: PropertyOption[];
  schedules: ScheduleRow[];
}) {
  const router = useRouter();
  const [addState, addAction, adding] = useActionState<ScheduleActionState, FormData>(
    async (prev, fd) => {
      const res = await createSchedule(prev, fd);
      if (res?.success) router.refresh();
      return res;
    },
    undefined,
  );

  const [kind, setKind] = useState<"report" | "revenue_reminder">("report");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [rowMsg, setRowMsg] = useState<ScheduleActionState>();
  const [busy, startRow] = useTransition();

  function row(fn: () => Promise<ScheduleActionState>) {
    setRowMsg(undefined);
    startRow(async () => {
      setRowMsg(await fn());
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Scheduled reports &amp; reminders</h2>
        <p className="text-muted-foreground text-sm">
          Email a performance report on a schedule, and remind the team to submit revenue each
          month.
        </p>
      </div>

      {!mailReady && (
        <div className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Email isn&rsquo;t configured on the server yet, so schedules will save but won&rsquo;t
            send. Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{" "}
            <code>SMTP_PASS</code> and <code>MAIL_FROM</code> in <code>.env</code>.
          </span>
        </div>
      )}

      {/* Add a schedule */}
      <section className="border-border bg-card rounded-xl border p-5">
        <h3 className="mb-4 text-sm font-semibold">New schedule</h3>
        <form action={addAction} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Weekly owner report" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">Type</Label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className={field}
            >
              <option value="report">Performance report</option>
              <option value="revenue_reminder">Revenue submission reminder</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="frequency">Frequency</Label>
            <select
              id="frequency"
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className={field}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {frequency === "weekly" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dayOfWeek">Day of week</Label>
              <select id="dayOfWeek" name="dayOfWeek" defaultValue={1} className={field}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dayOfMonth">Day of month</Label>
              <select id="dayOfMonth" name="dayOfMonth" defaultValue={1} className={field}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Time (server timezone)</Label>
            <div className="flex items-center gap-2">
              <select name="hour" defaultValue={8} className={cn(field, "flex-1")}>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">:</span>
              <select name="minute" defaultValue={0} className={cn(field, "flex-1")}>
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {kind === "report" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rangePreset">Report covers</Label>
                <select id="rangePreset" name="rangePreset" defaultValue="last7" className={field}>
                  {Object.entries(PRESET_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="propertyCode">Scope</Label>
                <select id="propertyCode" name="propertyCode" defaultValue="all" className={field}>
                  <option value="all">All hotels</option>
                  <PropertyOptions properties={properties} />
                </select>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="recipients">
              Recipients{" "}
              {kind === "revenue_reminder" && (
                <span className="text-muted-foreground font-normal">
                  — leave blank to send to all Owners &amp; Admins
                </span>
              )}
            </Label>
            <Input
              id="recipients"
              name="recipients"
              placeholder="owner@bluekarmasecrets.com, manager@bluekarmasecrets.com"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={adding}>
              <Plus className="mr-1.5 size-4" />
              {adding ? "Saving…" : "Create schedule"}
            </Button>
            {addState?.error && <span className="text-destructive text-sm">{addState.error}</span>}
            {addState?.success && (
              <span className="text-sm text-[color:var(--chart-3)]">{addState.success}</span>
            )}
          </div>
        </form>
      </section>

      {/* Existing schedules */}
      <section className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold">Schedules ({schedules.length})</h3>
          {rowMsg?.error && <span className="text-destructive text-xs">{rowMsg.error}</span>}
          {rowMsg?.success && <span className="text-muted-foreground text-xs">{rowMsg.success}</span>}
        </div>
        {schedules.length === 0 ? (
          <p className="text-muted-foreground border-border border-t px-5 py-8 text-center text-sm">
            No schedules yet. Add one above.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y border-t">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      {s.kind === "revenue_reminder" ? "Reminder" : "Report"}
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {describe(s)}
                    {s.kind === "report" && ` · ${PRESET_LABEL[s.rangePreset] ?? s.rangePreset}`}
                    {s.kind === "report" && ` · ${s.propertyCode ?? "All hotels"}`}
                    {" · "}
                    {s.recipients || "Owners & Admins"}
                    {s.lastSentAt && ` · last sent ${new Date(s.lastSentAt).toLocaleString()}`}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs select-none">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={busy}
                    onChange={(e) => row(() => setScheduleEnabled(s.id, e.target.checked))}
                    className="accent-primary size-3.5"
                  />
                  {s.enabled ? "On" : "Paused"}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => row(() => sendScheduleNow(s.id))}
                  title="Send now (test)"
                >
                  <Send className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete schedule "${s.name}"?`)) row(() => deleteSchedule(s.id));
                  }}
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
