const PROPERTIES = [
  { code: "BKDS", name: "Blue Karma Seminyak" },
  { code: "BKDU", name: "Blue Karma Ubud" },
  { code: "BKV", name: "Blue Karma Village" },
  { code: "ORACLE", name: "Oracle Yacht" },
] as const;

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-primary/[0.07] absolute top-[-15%] left-1/2 h-[500px] w-[900px] max-w-[95vw] -translate-x-1/2 rounded-full blur-[130px]" />
        <div className="bg-chart-1/[0.06] absolute bottom-[-20%] left-1/2 h-[300px] w-[600px] max-w-[95vw] -translate-x-1/2 rounded-full blur-[130px]" />
      </div>

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* Logo mark */}
        <div className="border-border bg-card mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
          <LogoMark className="h-8 w-8" />
        </div>

        <span className="border-border bg-card/60 text-muted-foreground mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Internal · Blue Karma Secrets
        </span>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ads Analytics Dashboard
        </h1>

        <p className="text-muted-foreground mt-4 max-w-md text-lg leading-relaxed text-balance">
          Google &amp; Meta ad performance for every property — pulled daily, unified, and ready to
          read at a glance.
        </p>

        {/* Property chips */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {PROPERTIES.map((p) => (
            <div
              key={p.code}
              title={p.name}
              className="border-border bg-card hover:border-foreground/20 flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors"
            >
              <span className="font-medium">{p.code}</span>
              <span className="text-muted-foreground hidden sm:inline">{p.name}</span>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-10 text-sm">
          Setup in progress — Phase 1 of 8 · project scaffold ready
        </p>
      </div>

      <footer className="text-muted-foreground/70 absolute bottom-6 font-mono text-xs">
        ads.bluekarmasecrets.com
      </footer>
    </main>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden role="img">
      <rect x="3" y="13" width="4" height="8" rx="1.2" className="fill-chart-2" />
      <rect x="10" y="8" width="4" height="13" rx="1.2" className="fill-primary" />
      <rect x="17" y="4" width="4" height="17" rx="1.2" className="fill-chart-1" />
    </svg>
  );
}
