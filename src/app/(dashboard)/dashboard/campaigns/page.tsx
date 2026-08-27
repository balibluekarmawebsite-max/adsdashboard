import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asRole, canManageCampaigns } from "@/lib/rbac";
import { CampaignManager } from "@/components/dashboard/campaign-manager";

export const metadata = { title: "Campaigns · Ads Dashboard" };

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageCampaigns(asRole(session.user.role))) redirect("/dashboard");

  const properties = await prisma.property.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });

  return <CampaignManager properties={properties} />;
}
