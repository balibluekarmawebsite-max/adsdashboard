import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPropertyOptions } from "@/lib/properties.server";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Defense-in-depth: the proxy already gates /dashboard, but re-check here so
  // the layout always has a real session to render from.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const properties = await listPropertyOptions();

  return (
    <DashboardShell
      user={{ email: session.user.email ?? "", role: session.user.role }}
      properties={properties}
    >
      {children}
    </DashboardShell>
  );
}
