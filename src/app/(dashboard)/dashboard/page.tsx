import { NewCampaignsNotice } from "@/components/dashboard/new-campaigns-notice";
import { AiSummaryCard } from "@/components/dashboard/ai-summary-card";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { OverviewBreakdowns } from "@/components/dashboard/overview-breakdowns";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { ExportMenu } from "@/components/dashboard/export-menu";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <ExportMenu />
      </div>
      <NewCampaignsNotice />
      <AiSummaryCard />
      <KpiRow />
      <TrendChart />
      <OverviewBreakdowns />
      <CampaignTable />
    </div>
  );
}
