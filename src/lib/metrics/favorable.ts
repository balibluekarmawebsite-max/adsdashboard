// Which direction of change is "favorable" for each metric. Colours a delta by
// whether it's good — not merely by its sign (a CPC/CPM *decrease* is good; a
// spend change is neither good nor bad on its own).

type Direction = "up" | "down" | "neutral";

const FAVORABLE: Record<string, Direction> = {
  impressions: "up",
  clicks: "up",
  conversions: "up",
  conversionValue: "up",
  ctr: "up",
  cvr: "up",
  roas: "up",
  cpc: "down",
  cpm: "down",
  spend: "neutral",
};

export type Sentiment = "positive" | "negative" | "neutral";

export function sentiment(metric: string, changePct: number | null | undefined): Sentiment {
  if (changePct == null || changePct === 0) return "neutral";
  const dir = FAVORABLE[metric] ?? "neutral";
  if (dir === "neutral") return "neutral";
  const isUp = changePct > 0;
  return isUp === (dir === "up") ? "positive" : "negative";
}
