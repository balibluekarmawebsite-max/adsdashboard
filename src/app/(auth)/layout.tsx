import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Blue Karma Secrets home">
          <Logo className="text-foreground w-40" />
        </Link>
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
