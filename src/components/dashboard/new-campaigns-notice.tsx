"use client";

import useSWR from "swr";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";

async function fetcher(url: string): Promise<{ count: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("failed");
  return res.json() as Promise<{ count: number }>;
}

/** Banner shown on the overview when new campaigns await review (Owners/Admins
 *  only — the endpoint returns 0 for everyone else, so this self-hides). */
export function NewCampaignsNotice() {
  const { data } = useSWR("/api/campaigns/pending", fetcher, { revalidateOnFocus: false });
  const count = data?.count ?? 0;
  if (count <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-amber-700 dark:text-amber-300">
        <strong>
          {count} new campaign{count === 1 ? "" : "s"}
        </strong>{" "}
        detected — decide which appear on the report.
      </span>
      <Link
        href="/dashboard/campaigns"
        className="ml-auto rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/30 dark:text-amber-300"
      >
        Review campaigns
      </Link>
    </motion.div>
  );
}
