"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { DateRangeControl } from "./date-range-control";
import { PlatformToggle } from "./platform-toggle";
import { PropertySelect } from "./property-select";
import type { PropertyOption } from "./shell";

export function TopBar({
  user,
  properties,
}: {
  user: { email: string; role?: string };
  properties: PropertyOption[];
}) {
  const pathname = usePathname();
  const isOverview = pathname === "/dashboard";
  const title = pathname.startsWith("/dashboard/users") ? "Team" : "Overview";

  return (
    <header className="bg-background/85 border-border sticky top-0 z-20 border-b backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <Logo className="text-foreground w-28 lg:hidden" />
        <h1 className="hidden text-base font-semibold lg:block">{title}</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isOverview && (
            <>
              <PropertySelect properties={properties} className="lg:hidden" />
              <PlatformToggle />
              <DateRangeControl />
            </>
          )}
          <ThemeToggle />
          <span className="text-muted-foreground hidden max-w-[16ch] truncate text-xs md:inline">
            {user.email}
          </span>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
