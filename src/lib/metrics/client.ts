"use client";

import useSWR from "swr";
import { useFilters } from "@/components/providers/filters-provider";
import type {
  SummaryResult,
  TimeseriesResult,
  ByPlatformResult,
  ByPropertyResult,
  ByCampaignResult,
} from "@/lib/metrics/query";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const SWR_OPTS = { keepPreviousData: true, revalidateOnFocus: false } as const;

function useMetric<T>(endpoint: string, extra?: Record<string, string>) {
  const { from, to, platform, property } = useFilters();
  const params = new URLSearchParams({ from, to });
  if (platform !== "all") params.set("platform", platform);
  if (property !== "all") params.set("property", property);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return useSWR<T>(`/api/metrics/${endpoint}?${params.toString()}`, fetcher, SWR_OPTS);
}

export const useSummary = () => useMetric<SummaryResult>("summary");
export const useTimeseries = () => useMetric<TimeseriesResult>("timeseries");
export const useByPlatform = () => useMetric<ByPlatformResult>("by-platform");
export const useByCampaign = () => useMetric<ByCampaignResult>("by-campaign");

/** Property comparison ignores the property filter (its job is to compare all). */
export function useByProperty() {
  const { from, to, platform } = useFilters();
  const params = new URLSearchParams({ from, to });
  if (platform !== "all") params.set("platform", platform);
  return useSWR<ByPropertyResult>(
    `/api/metrics/by-property?${params.toString()}`,
    fetcher,
    SWR_OPTS,
  );
}
