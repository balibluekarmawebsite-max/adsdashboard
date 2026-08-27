"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { LayoutDashboard, Users, Wallet, Megaphone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { asRole, canManageUsers, canManageRevenue, canManageCampaigns } from "@/lib/rbac";

async function pendingFetcher(url: string): Promise<{ count: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("failed");
  return res.json() as Promise<{ count: number }>;
}
import { useFilters } from "@/components/providers/filters-provider";
import type { PropertyOption } from "./shell";

export function Sidebar({
  properties,
  user,
}: {
  properties: PropertyOption[];
  user: { role?: string };
}) {
  const { property, setProperty } = useFilters();
  const pathname = usePathname();
  const isOverview = pathname === "/dashboard";
  const showTeam = canManageUsers(asRole(user.role));
  const showRevenue = canManageRevenue(asRole(user.role));
  const showCampaigns = canManageCampaigns(asRole(user.role));
  const { data: pending } = useSWR(
    showCampaigns ? "/api/campaigns/pending" : null,
    pendingFetcher,
    { revalidateOnFocus: false },
  );
  const pendingCount = pending?.count ?? 0;

  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 flex-col border-r lg:flex">
      <div className="border-sidebar-border flex h-14 items-center border-b px-5">
        <Logo className="text-sidebar-foreground w-32" />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="space-y-1">
          <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
            Menu
          </p>
          <NavLink
            href="/dashboard"
            active={isOverview}
            icon={<LayoutDashboard className="size-4" />}
          >
            Overview
          </NavLink>
          {showCampaigns && (
            <NavLink
              href="/dashboard/campaigns"
              active={pathname.startsWith("/dashboard/campaigns")}
              icon={<Megaphone className="size-4" />}
            >
              <span className="flex-1">Campaigns</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          )}
          {showRevenue && (
            <NavLink
              href="/dashboard/revenue"
              active={pathname.startsWith("/dashboard/revenue")}
              icon={<Wallet className="size-4" />}
            >
              Revenue
            </NavLink>
          )}
          {showTeam && (
            <NavLink
              href="/dashboard/users"
              active={pathname.startsWith("/dashboard/users")}
              icon={<Users className="size-4" />}
            >
              Team
            </NavLink>
          )}
        </div>

        {isOverview && (
          <div className="space-y-1">
            <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
              Properties
            </p>
            <PropertyItem active={property === "all"} onClick={() => setProperty("all")}>
              <span className="font-medium">All properties</span>
            </PropertyItem>
            {properties.map((p) => (
              <PropertyItem
                key={p.code}
                active={property === p.code}
                onClick={() => setProperty(p.code)}
              >
                <span className="font-medium">{p.code}</span>
                <span className="text-muted-foreground truncate text-xs">{p.name}</span>
              </PropertyItem>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function PropertyItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      {children}
    </button>
  );
}
