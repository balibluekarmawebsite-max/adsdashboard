"use client";

import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useFilters } from "@/components/providers/filters-provider";
import type { PropertyOption } from "./shell";

export function Sidebar({ properties }: { properties: PropertyOption[] }) {
  const { property, setProperty } = useFilters();

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
          <span className="bg-sidebar-accent text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            Overview
          </span>
        </div>

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
      </nav>
    </aside>
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
