import { getGoogleConfig } from "./config";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Read-only reporting only needs the adwords scope.
const SCOPE = "https://www.googleapis.com/auth/adwords";

/** Build the Google consent URL. offline + prompt=consent guarantees a refresh token. */
export function buildConsentUrl(state: string): string {
  const cfg = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** Exchange the authorization code for tokens (server-to-server). */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const cfg = getGoogleConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as GoogleTokenResponse;
}
