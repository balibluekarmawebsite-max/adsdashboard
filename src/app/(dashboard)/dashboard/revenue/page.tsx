import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asRole, canManageRevenue } from "@/lib/rbac";
import { RevenueManager } from "@/components/dashboard/revenue-manager";

export const metadata = { title: "Revenue · Ads Dashboard" };

export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageRevenue(asRole(session.user.role))) redirect("/dashboard");

  const properties = await prisma.property.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });

  return <RevenueManager properties={properties} />;
}
