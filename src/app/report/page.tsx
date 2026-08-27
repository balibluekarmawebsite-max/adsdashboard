import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { parseMetricsParams } from "@/lib/metrics/query";
import { buildReport, type ReportSeriesPoint } from "@/lib/export/report";
import { formatMoney, formatNumber, formatRatioPct, formatRoas, formatDelta } from "@/lib/format";
import { PrintBar } from "./print-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ads Report · Blue Karma Secrets" };

const NAVY = "#005A7C";
const INK = "#12333F";
const MUTED = "#5B7280";
const LINE = "#e2eaee";
const TILE = "#f2f6f8";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  if (!params.get("from") || !params.get("to")) {
    const today = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    params.set("from", ymd(from));
    params.set("to", ymd(today));
  }

  const filter = await parseMetricsParams(params);
  const model = await buildReport(filter);
  const cur = model.scope.currency;
  const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, cur));

  const kpis: { label: string; value: string; delta: number | null }[] = [
    { label: "Spend", value: money(model.kpis.spend), delta: model.kpis.changePct.spend ?? null },
    { label: "Impressions", value: formatNumber(model.kpis.impressions), delta: model.kpis.changePct.impressions ?? null },
    { label: "Clicks", value: formatNumber(model.kpis.clicks), delta: model.kpis.changePct.clicks ?? null },
    { label: "CTR", value: formatRatioPct(model.kpis.ctr), delta: model.kpis.changePct.ctr ?? null },
    { label: "Conversions", value: formatNumber(model.kpis.conversions), delta: model.kpis.changePct.conversions ?? null },
    { label: "ROAS", value: formatRoas(model.kpis.roas), delta: model.kpis.changePct.roas ?? null },
    { label: "Revenue", value: money(model.kpis.revenue), delta: null },
    { label: "CPC", value: money(model.kpis.cpc), delta: model.kpis.changePct.cpc ?? null },
  ];
  const isCampaigns = model.breakdown.kind === "campaigns";

  return (
    <div style={{ background: "#fff", color: INK }} className="min-h-screen">
      <style>{`
        :root { color-scheme: light; }
        html, body { background: #fff; }
        @page { size: A4; margin: 13mm; }
        @media print {
          .no-print { display: none !important; }
          .report { box-shadow: none !important; margin: 0 !important; }
          .avoid-break { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <PrintBar />

      <div
        className="report mx-auto my-6 max-w-[960px] bg-white px-8 py-8 sm:px-10"
        style={{ boxShadow: "0 1px 24px rgba(18,51,63,0.08)" }}
      >
        {/* Header */}
        <header
          className="avoid-break flex flex-wrap items-end justify-between gap-4 border-b pb-5"
          style={{ borderColor: NAVY, borderBottomWidth: 2 }}
        >
          <div>
            <div className="text-[13px] font-semibold tracking-[0.18em]" style={{ color: NAVY }}>
              BLUE KARMA <span className="font-normal">SECRETS</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold" style={{ color: INK }}>
              Ads Performance Report
            </h1>
            <p className="mt-2 text-[15px]">
              <span className="font-semibold" style={{ color: NAVY }}>
                {model.scope.propertyLabel}
              </span>
              <span style={{ color: MUTED }}> · {model.scope.platformLabel}</span>
            </p>
          </div>
          <div className="text-right text-[13px]" style={{ color: MUTED }}>
            <div className="font-medium" style={{ color: INK }}>
              {model.scope.from} → {model.scope.to}
            </div>
            <div>{model.scope.days} days</div>
            <div className="mt-1">
              Generated {new Date(model.scope.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="avoid-break mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-lg border p-3.5"
              style={{ background: TILE, borderColor: LINE }}
            >
              <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: MUTED }}>
                {k.label}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: INK }}>
                {k.value}
              </div>
              {k.delta != null && (
                <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
                  {k.delta > 0 ? "▲" : k.delta < 0 ? "▼" : "•"} {formatDelta(k.delta)} vs prev
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Spend trend */}
        <section className="avoid-break mt-8">
          <h2 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
            Spend over time
          </h2>
          <Trend series={model.series} />
        </section>

        {/* Breakdown */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold" style={{ color: INK }}>
            {model.breakdown.title}
          </h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ background: NAVY, color: "#fff" }}>
                <th className="px-3 py-2 text-left font-semibold">{isCampaigns ? "Campaign" : "Hotel"}</th>
                {isCampaigns ? (
                  <th className="px-3 py-2 text-left font-semibold">Platform</th>
                ) : null}
                <th className="px-3 py-2 text-right font-semibold">Spend</th>
                <th className="px-3 py-2 text-right font-semibold">Impr.</th>
                <th className="px-3 py-2 text-right font-semibold">Clicks</th>
                <th className="px-3 py-2 text-right font-semibold">Conv.</th>
                <th className="px-3 py-2 text-right font-semibold">ROAS</th>
                {isCampaigns ? null : <th className="px-3 py-2 text-right font-semibold">Revenue</th>}
              </tr>
            </thead>
            <tbody>
              {model.breakdown.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center" style={{ color: MUTED }}>
                    No campaigns on the report for this view.
                  </td>
                </tr>
              ) : (
                model.breakdown.rows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }} className="avoid-break">
                    <td className="max-w-[24rem] truncate px-3 py-2" style={{ color: INK }}>
                      {r.label}
                      {r.sublabel ? (
                        <span style={{ color: MUTED }}> · {r.sublabel}</span>
                      ) : null}
                    </td>
                    {isCampaigns ? (
                      <td className="px-3 py-2 capitalize" style={{ color: MUTED }}>
                        {r.platform}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.conversions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRoas(r.roas)}</td>
                    {isCampaigns ? null : (
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* AI summary */}
        {model.aiSummary ? (
          <section className="avoid-break mt-8 rounded-lg border p-5" style={{ borderColor: LINE, background: TILE }}>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>
              Summary &amp; recommendations
            </h2>
            <Summary text={model.aiSummary} />
          </section>
        ) : null}

        <footer className="mt-10 border-t pt-4 text-[11px]" style={{ borderColor: LINE, color: MUTED }}>
          Blue Karma Secrets — Ads Performance Report · Confidential.
          {model.scope.mixedCurrency
            ? " Figures span multiple currencies; totals shown are unconverted."
            : cur
              ? ` All figures in ${cur}.`
              : ""}
        </footer>
      </div>
    </div>
  );
}

function Trend({ series }: { series: ReportSeriesPoint[] }) {
  if (series.length < 2) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: LINE, color: MUTED }}>
        Not enough data to chart this range.
      </div>
    );
  }
  const W = 900;
  const H = 240;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...series.map((p) => p.spend), 1);
  const x = (i: number) => padL + (i / (series.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.spend).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const ticks = [0, Math.floor((series.length - 1) / 2), series.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spend over time" style={{ display: "block" }}>
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke={LINE} strokeWidth={1} />
      <path d={area} fill={NAVY} opacity={0.08} />
      <path d={line} fill="none" stroke={NAVY} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize={11} fill={MUTED} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>
          {series[i].date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

function Summary({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: "#22424e" }}>
      {lines.map((raw, i) => {
        const s = raw.trim();
        if (!s) return null;
        const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        if (/^#{1,6}\s/.test(s)) {
          return (
            <p key={i} className="mt-3 font-semibold" style={{ color: INK }}>
              {clean(s.replace(/^#{1,6}\s*/, ""))}
            </p>
          );
        }
        if (/^[-*]\s/.test(s)) {
          return (
            <p key={i} className="pl-4">
              • {clean(s.replace(/^[-*]\s*/, ""))}
            </p>
          );
        }
        return <p key={i}>{clean(s)}</p>;
      })}
    </div>
  );
}
