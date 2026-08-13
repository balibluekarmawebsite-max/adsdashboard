import { KpiRow } from "@/components/dashboard/kpi-row";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiRow />

      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
        Trend chart, Google-vs-Meta split, property comparison, and the campaign table arrive in the
        next build step.
      </div>
    </div>
  );
}
