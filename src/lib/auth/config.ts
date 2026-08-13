import type { NextAuthConfig } from "next-auth";

// Edge-safe base config shared by the middleware and the full server config.
// MUST NOT import Prisma, bcrypt, or any Node-only code — the middleware runs
// on the edge runtime and only needs to decode/validate the JWT.
export const authConfig = {
  trustHost: true, // required behind a reverse proxy (our VPS/Nginx setup)
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // Route protection: only /dashboard/* requires a session.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // the Credentials provider is added in ./index.ts (Node runtime)
} satisfies NextAuthConfig;
