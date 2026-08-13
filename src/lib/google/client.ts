import { GoogleAdsApi, type Customer } from "google-ads-api";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getGoogleConfig, normalizeCustomerId } from "./config";

/**
 * Resolve the Google refresh token: prefer the encrypted, DB-stored connection
 * (captured via the OAuth consent flow), then fall back to GOOGLE_REFRESH_TOKEN.
 */
export async function resolveGoogleRefreshToken(): Promise<string> {
  const connection = await prisma.platformConnection.findFirst({
    where: { platform: "google", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (connection) return decryptSecret(connection.secretEncrypted);

  if (process.env.GOOGLE_REFRESH_TOKEN) return process.env.GOOGLE_REFRESH_TOKEN;

  throw new Error(
    "No Google refresh token available. Authorize once at /api/auth/google, or set GOOGLE_REFRESH_TOKEN.",
  );
}

/** Build a google-ads-api Customer for a given external account id. */
export async function getGoogleCustomer(externalAccountId: string): Promise<Customer> {
  const cfg = getGoogleConfig();
  const refreshToken = await resolveGoogleRefreshToken();

  const client = new GoogleAdsApi({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    developer_token: cfg.developerToken,
  });

  return client.Customer({
    customer_id: normalizeCustomerId(externalAccountId),
    refresh_token: refreshToken,
    login_customer_id: cfg.loginCustomerId,
  });
}
