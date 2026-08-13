import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export interface MetaConfig {
  apiVersion: string;
  appId?: string;
}

export function getMetaConfig(): MetaConfig {
  return {
    apiVersion: process.env.META_GRAPH_API_VERSION ?? "v25.0",
    appId: process.env.META_APP_ID,
  };
}

/**
 * Resolve the Meta System User token: prefer the encrypted DB-stored connection
 * (see `npm run connect:meta`), then fall back to META_SYSTEM_USER_TOKEN.
 */
export async function resolveMetaToken(): Promise<string> {
  const connection = await prisma.platformConnection.findFirst({
    where: { platform: "meta", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (connection) return decryptSecret(connection.secretEncrypted);

  if (process.env.META_SYSTEM_USER_TOKEN) return process.env.META_SYSTEM_USER_TOKEN;

  throw new Error(
    "No Meta token available. Set META_SYSTEM_USER_TOKEN, or run `npm run connect:meta` to store one.",
  );
}

/** Ad account ids are passed as act_<digits>; accept "act_123", "123", or "1-2-3". */
export function normalizeMetaAccountId(id: string): string {
  return id.replace(/^act_/, "").replace(/[^0-9]/g, "");
}
