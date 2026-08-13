"use client";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
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
  return (
    <header className="bg-background/85 border-border sticky top-0 z-20 border-b backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <Logo className="text-foreground w-28 lg:hidden" />
        <h1 className="hidden text-base font-semibold lg:block">Overview</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PropertySelect properties={properties} className="lg:hidden" />
          <PlatformToggle />
          <DateRangeControl />
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
