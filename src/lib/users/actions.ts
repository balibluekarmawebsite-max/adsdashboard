"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  asRole,
  assignableRoles,
  canManageUsers,
  canModifyUser,
  isRole,
  type Role,
} from "@/lib/rbac";

export type UserActionState = { error?: string; success?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The signed-in actor, with a coerced Role. Null when not authenticated. */
async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: asRole(session.user.role) };
}

/** Create a user. Owners/Admins only; Admins may create Members only. */
export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const me = await currentActor();
  if (!me || !canManageUsers(me.role)) return { error: "You are not allowed to add users." };

  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "MEMBER");

  if (!email || !password) return { error: "Email and password are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!isRole(roleRaw) || !assignableRoles(me.role).includes(roleRaw)) {
    return { error: "You can't assign that role." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, name: name || null, passwordHash, role: roleRaw } });

  revalidatePath("/dashboard/users");
  return { success: `Added ${email} as ${roleRaw.toLowerCase()}.` };
}

/** Change a user's role, within the actor's authority. */
export async function updateUserRole(userId: string, nextRole: Role): Promise<UserActionState> {
  const me = await currentActor();
  if (!me) return { error: "Not signed in." };
  if (!isRole(nextRole) || !assignableRoles(me.role).includes(nextRole)) {
    return { error: "You can't assign that role." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  const targetRole = asRole(target.role);
  if (!canModifyUser(me.role, targetRole)) return { error: "You can't modify that user." };
  if (targetRole === nextRole) return { success: "No change." };

  // Never leave the app without an Owner.
  if (targetRole === "OWNER" && nextRole !== "OWNER") {
    const owners = await prisma.user.count({ where: { role: "OWNER" } });
    if (owners <= 1) return { error: "You can't remove the last Owner." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });
  revalidatePath("/dashboard/users");
  return { success: "Role updated." };
}

/**
 * Set which properties a MEMBER may see. An empty list means unrestricted (all
 * properties). Owners/Admins are always unrestricted, so this is rejected for
 * them. Owners/Admins only.
 */
export async function setUserProperties(
  userId: string,
  propertyCodes: string[],
): Promise<UserActionState> {
  const me = await currentActor();
  if (!me || !canManageUsers(me.role)) return { error: "You are not allowed to manage access." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };
  const targetRole = asRole(target.role);
  if (!canModifyUser(me.role, targetRole)) return { error: "You can't modify that user." };
  if (targetRole !== "MEMBER") return { error: "Owners and Admins always see every property." };

  const codes = Array.from(new Set(propertyCodes.filter(Boolean)));
  const properties = codes.length
    ? await prisma.property.findMany({ where: { code: { in: codes } }, select: { id: true } })
    : [];
  const ids = properties.map((p) => p.id);

  // Replace the whole set atomically.
  await prisma.$transaction([
    prisma.userProperty.deleteMany({ where: { userId } }),
    ...(ids.length
      ? [prisma.userProperty.createMany({ data: ids.map((propertyId) => ({ userId, propertyId })) })]
      : []),
  ]);

  revalidatePath("/dashboard/users");
  return {
    success: ids.length
      ? `Access updated — ${ids.length} ${ids.length === 1 ? "property" : "properties"}.`
      : "Access set to all properties.",
  };
}

/** Remove a user, within the actor's authority. */
export async function deleteUser(userId: string): Promise<UserActionState> {
  const me = await currentActor();
  if (!me) return { error: "Not signed in." };
  if (userId === me.id) return { error: "You can't remove your own account." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  const targetRole = asRole(target.role);
  if (!canModifyUser(me.role, targetRole)) return { error: "You can't remove that user." };

  if (targetRole === "OWNER") {
    const owners = await prisma.user.count({ where: { role: "OWNER" } });
    if (owners <= 1) return { error: "You can't remove the last Owner." };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/dashboard/users");
  return { success: "User removed." };
}
