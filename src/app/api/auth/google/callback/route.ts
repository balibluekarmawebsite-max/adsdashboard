import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { getGoogleConfig } from "@/lib/google/config";

export const runtime = "nodejs";

// OAuth callback: verify state, exchange the code, and store the refresh token
// ENCRYPTED in platformConnections. Redirects back to the dashboard with status.
export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams, origin } = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(`${origin}/dashboard?google=${status}`);

  if (searchParams.get("error")) return back("denied");
  const code = searchParams.get("code");
  if (!code) return back("missing_code");

  const savedState = (await cookies()).get("g_oauth_state")?.value;
  if (!savedState || savedState !== searchParams.get("state")) return back("bad_state");

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) return back("no_refresh_token");

  const cfg = getGoogleConfig();
  const accountRef = cfg.loginCustomerId ?? "google-oauth";
  await prisma.platformConnection.upsert({
    where: { platform_accountRef: { platform: "google", accountRef } },
    create: {
      platform: "google",
      accountRef,
      secretEncrypted: encryptSecret(tokens.refresh_token),
      status: "active",
    },
    update: { secretEncrypted: encryptSecret(tokens.refresh_token), status: "active" },
  });

  const res = back("connected");
  res.cookies.delete("g_oauth_state");
  return res;
}
