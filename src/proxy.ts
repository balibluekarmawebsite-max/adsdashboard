import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Next 16 renamed the "middleware" file convention to "proxy". We delegate to
// NextAuth's edge-safe handler, whose `authorized` callback (in authConfig)
// gates /dashboard/* and redirects logged-out users to /login.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except the auth API, Next internals, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
