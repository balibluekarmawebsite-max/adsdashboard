import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { asRole } from "@/lib/rbac";

/**
 * The property ids the signed-in user is allowed to see, or `null` for
 * unrestricted (all properties).
 *
 * - Owners and Admins are always unrestricted.
 * - A Member is unrestricted until they're assigned specific properties; once
 *   they have assignments they see only those (hotels and/or outlets).
 *
 * This is the single source of truth for per-user access — every data query
 * that can leak another property's numbers funnels through it.
 */
export async function allowedPropertyIds(): Promise<string[] | null> {
  const session = await auth();
  if (!session?.user?.id) return []; // no session → see nothing (defensive; routes already gate)

  const role = asRole(session.user.role);
  if (role === "OWNER" || role === "ADMIN") return null;

  const rows = await prisma.userProperty.findMany({
    where: { userId: session.user.id },
    select: { propertyId: true },
  });
  return rows.length === 0 ? null : rows.map((r) => r.propertyId);
}
