"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light/dark toggle. The theme is just the `.dark` class on <html>; an inline
 * script in the root layout applies the saved choice before paint (default
 * light), so this only needs to flip the class and persist the preference.
 * Both icons are always in the DOM and CSS picks which to show, which keeps it
 * free of hydration mismatches.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* private mode / storage disabled — theme just won't persist */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle light / dark"
      className={cn(
        "border-input text-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors",
        className,
      )}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="block size-4 dark:hidden" />
    </button>
  );
}
