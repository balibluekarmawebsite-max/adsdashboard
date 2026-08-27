import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPropertyOptions } from "@/lib/properties.server";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import { CampaignManager } from "@/components/dashboard/campaign-manager";

export const metadata = { title: "Campaigns · Ads Dashboard" };

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageCampaigns(asRole(session.user.role))) redirect("/dashboard");

  const properties = await listPropertyOptions();

  return <CampaignManager properties={properties} />;
}
