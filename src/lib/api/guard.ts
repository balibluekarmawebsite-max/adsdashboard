import { auth } from "@/lib/auth";
import { ApiError } from "./errors";

/** Require an authenticated session or throw a 401 (caught by errorResponse). */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  return session;
}
