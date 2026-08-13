import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Signed in as <span className="text-foreground font-medium">{session?.user?.email}</span>
        {session?.user?.role ? ` · ${session.user.role}` : ""}.
      </p>

      <div className="border-border bg-card mt-6 rounded-xl border p-6">
        <h2 className="font-medium">Coming next</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Auth and the database are in place. The overview — KPI cards, trend charts, and
          platform/property comparisons — arrives in Phase 6, once Google &amp; Meta data is flowing
          into <code className="text-foreground">metrics_daily</code> (Phases 3–5).
        </p>
      </div>
    </div>
  );
}
