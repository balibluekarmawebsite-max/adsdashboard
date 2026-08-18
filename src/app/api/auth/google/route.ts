import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { asRole, canManageConnections } from "@/lib/rbac";
import { buildConsentUrl } from "@/lib/google/oauth";

export const runtime = "nodejs";

// Start the one-time Google OAuth consent (Owner/Admin only). Sets a CSRF state
// cookie and redirects to Google; the refresh token is captured in ./callback.
export async function GET() {
  const session = await auth();
  if (!canManageConnections(asRole(session?.user?.role))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildConsentUrl(state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
