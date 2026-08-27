// Client-safe campaign constants (no server-only imports).

export type ReportStatus = "pending" | "included" | "excluded";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  included: "On report",
  pending: "New — review",
  excluded: "Hidden",
};
