import { timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors";

// Machine-to-machine auth for the public reporting API (/api/v1/*). A caller
// presents a shared secret as `Authorization: Bearer <key>` or `X-API-Key: <key>`.
// Keys live in the REPORTING_API_KEY env var (comma-separated to allow rotating
// or issuing more than one). Never store them in the database or the client.

function configuredKeys(): string[] {
  return (process.env.REPORTING_API_KEY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when at least one API key is configured. */
export function reportingApiConfigured(): boolean {
  return configuredKeys().length > 0;
}

/** Constant-time string compare (length-safe). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function presentedKey(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

/**
 * Throw unless the request carries a valid reporting API key.
 * 503 if the API isn't configured on this server; 401 if the key is wrong/missing.
 */
export function requireApiKey(request: Request): void {
  const keys = configuredKeys();
  if (keys.length === 0) {
    throw new ApiError(503, "Reporting API is not enabled on this server (REPORTING_API_KEY unset).");
  }
  const provided = presentedKey(request);
  if (!provided || !keys.some((k) => safeEqual(k, provided))) {
    throw new ApiError(401, "Invalid or missing API key.");
  }
}
