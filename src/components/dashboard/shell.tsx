"use client";

import { type ReactNode } from "react";
import { FiltersProvider } from "@/components/providers/filters-provider";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export interface PropertyOption {
  code: string;
  name: string;
}

export function DashboardShell({
  user,
  properties,
  children,
}: {
  user: { email: string; role?: string };
  properties: PropertyOption[];
  children: ReactNode;
}) {
  return (
    <FiltersProvider>
      <div className="flex min-h-svh">
        <Sidebar properties={properties} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} properties={properties} />
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </FiltersProvider>
  );
}
