"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

/** Sign in with email + password. On success, signIn throws a redirect. */
export async function authenticate(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error; // re-throw the redirect (NEXT_REDIRECT) and anything unexpected
  }
}

/**
 * Register a new account.
 * - The very first user bootstraps as ADMIN (no seeded password needed).
 * - After that, self-registration is blocked unless ALLOW_PUBLIC_REGISTRATION=true,
 *   so randoms can't sign up to an internet-facing internal tool.
 */
export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) return { error: "Email and password are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const userCount = await prisma.user.count();
  const allowPublic = process.env.ALLOW_PUBLIC_REGISTRATION === "true";
  if (userCount > 0 && !allowPublic) {
    return { error: "Registration is disabled. Ask an admin to create your account." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: userCount === 0 ? "ADMIN" : "MEMBER",
    },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Please log in." };
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
