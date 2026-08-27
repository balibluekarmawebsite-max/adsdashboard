import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPropertyOptions } from "@/lib/properties.server";
import { asRole, canManageRevenue } from "@/lib/rbac";
import { RevenueManager } from "@/components/dashboard/revenue-manager";

export const metadata = { title: "Revenue · Ads Dashboard" };

export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageRevenue(asRole(session.user.role))) redirect("/dashboard");

  const properties = await listPropertyOptions();

  return <RevenueManager properties={properties} />;
}
