import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPropertyOptions } from "@/lib/properties.server";
import { asRole, canManageRevenue } from "@/lib/rbac";
import { monthLabel } from "@/lib/revenue/constants";
import { RevenueManager } from "@/components/dashboard/revenue-manager";

export const metadata = { title: "Revenue · Ads Dashboard" };

/** Active properties still missing revenue for the previous calendar month. */
async function missingLastMonth() {
  const now = new Date();
  const lastPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  lastPrev.setUTCDate(0);
  const year = lastPrev.getUTCFullYear();
  const month = lastPrev.getUTCMonth() + 1;

  const [props, have] = await Promise.all([
    prisma.property.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    prisma.revenueMonthly.findMany({ where: { year, month }, select: { propertyId: true } }),
  ]);
  const haveSet = new Set(have.map((h) => h.propertyId));
  return { year, month, missing: props.filter((p) => !haveSet.has(p.id)) };
}

export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageRevenue(asRole(session.user.role))) redirect("/dashboard");

  const [properties, { year, month, missing }] = await Promise.all([
    listPropertyOptions(),
    missingLastMonth(),
  ]);

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <div className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>
              {missing.length} propert{missing.length === 1 ? "y" : "ies"} still missing{" "}
              {monthLabel(month)} {year} revenue
            </strong>{" "}
            — {missing.map((p) => p.name).join(", ")}. Add it below so the reports and ROAS are
            complete.
          </span>
        </div>
      )}
      <RevenueManager properties={properties} />
    </div>
  );
}
