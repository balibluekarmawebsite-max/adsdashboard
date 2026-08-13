import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Defense-in-depth: middleware already gates /dashboard, but re-check here so
  // the layout always has a real session to render from.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <Logo className="text-foreground w-32" />
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {session.user.email}
          </span>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
