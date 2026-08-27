// Role-based access control for the dashboard.
// Hierarchy: OWNER > ADMIN > MEMBER. Kept tiny and dependency-free so the
// server actions and the UI can share exactly the same rules.

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export const ROLES: readonly Role[] = ["OWNER", "ADMIN", "MEMBER"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function isRole(value: unknown): value is Role {
  return value === "OWNER" || value === "ADMIN" || value === "MEMBER";
}

/** Coerce an unknown (e.g. a session role string) to a Role, defaulting to MEMBER. */
export function asRole(value: unknown): Role {
  return isRole(value) ? value : "MEMBER";
}

/** Who may open the Team / user-management area at all. */
export function canManageUsers(actor: Role): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

/** Who may connect or manage platform integrations (Google / Meta). */
export function canManageConnections(actor: Role): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

/** Who may enter, upload, edit, or delete monthly revenue figures. */
export function canManageRevenue(actor: Role): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

/** Who may review campaigns and choose which appear on the report. */
export function canManageCampaigns(actor: Role): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

/** Roles this actor may assign when creating or editing a user. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "OWNER") return ["OWNER", "ADMIN", "MEMBER"];
  if (actor === "ADMIN") return ["MEMBER"];
  return [];
}

/**
 * Whether `actor` may change the role of, or remove, a user who currently holds
 * `target`. Owners may act on anyone; Admins only on Members. (Last-Owner
 * protection and self-removal are enforced separately in the server actions.)
 */
export function canModifyUser(actor: Role, target: Role): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER";
  return false;
}
