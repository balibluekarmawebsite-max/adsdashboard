import { prisma } from "@/lib/db";

// App-wide settings, stored one row per key in `app_settings`. Reads are resilient
// to the table not existing yet (pre-migration) — they fall back to the default.

const SHOW_VARIANCE = "showVariance";

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null; // table not migrated yet, etc.
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Whether reports (dashboard, exports, emails) show the period-over-period
 * variance %. Defaults to ON — only an explicit "false" turns it off.
 */
export async function getShowVariance(): Promise<boolean> {
  return (await getSetting(SHOW_VARIANCE)) !== "false";
}

export async function setShowVariance(on: boolean): Promise<void> {
  await setSetting(SHOW_VARIANCE, on ? "true" : "false");
}
