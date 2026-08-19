import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const PROPERTIES = [
  { code: "BKDS", name: "Blue Karma Seminyak" },
  { code: "BKDU", name: "Blue Karma Ubud" },
  { code: "BKV", name: "Blue Karma Village" },
] as const;

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-primary/[0.08] absolute top-[-15%] left-1/2 h-[500px] w-[900px] max-w-[95vw] -translate-x-1/2 rounded-full blur-[130px]" />
        <div className="bg-brand-sky/[0.06] absolute bottom-[-20%] left-1/2 h-[300px] w-[600px] max-w-[95vw] -translate-x-1/2 rounded-full blur-[130px]" />
      </div>

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* Brand wordmark */}
        <Logo className="text-foreground mb-10 w-64 sm:w-72" />

        <span className="border-border bg-card/60 text-muted-foreground mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="bg-brand-sky h-1.5 w-1.5 rounded-full" />
          Internal tool · Blue Karma Secrets
        </span>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Blue Karma Ads Dashboard
        </h1>

        <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed text-balance">
          The internal advertising analytics dashboard for Blue Karma Secrets. It securely connects
          to our own Google Ads and Meta (Facebook &amp; Instagram) accounts to pull daily campaign
          performance — spend, reach, conversions, and ROAS — and unifies it across our properties in
          one private view.
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

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign in
          </Link>
          <p className="text-muted-foreground text-xs">Authorized Blue Karma team members only</p>
        </div>
      </div>

      <footer className="text-muted-foreground/70 absolute bottom-6 flex items-center gap-3 font-mono text-xs">
        <span>ads.bluekarmasecrets.com</span>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms
        </Link>
      </footer>
    </main>
  );
}
