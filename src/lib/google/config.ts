// Google Ads API configuration, read from env. Secrets never hardcoded.
export interface GoogleConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  /** Optional MCP/manager account id used as login-customer-id (digits only). */
  loginCustomerId?: string;
  /** Redirect URI registered in Google Cloud for the OAuth consent flow. */
  redirectUri: string;
}

/** Digits-only customer id (Google customer ids are often written 123-456-7890). */
export function normalizeCustomerId(id: string): string {
  return id.replace(/[^0-9]/g, "");
}

export function getGoogleConfig(): GoogleConfig {
  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!developerToken || !clientId || !clientSecret) {
    throw new Error(
      "Missing Google Ads config. Set GOOGLE_DEVELOPER_TOKEN, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.",
    );
  }

  const loginCustomerId = process.env.GOOGLE_LOGIN_CUSTOMER_ID
    ? normalizeCustomerId(process.env.GOOGLE_LOGIN_CUSTOMER_ID)
    : undefined;

  return {
    developerToken,
    clientId,
    clientSecret,
    loginCustomerId,
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback",
  };
}
