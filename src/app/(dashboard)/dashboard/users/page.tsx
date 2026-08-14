import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asRole, canManageUsers } from "@/lib/rbac";
import { UserManagement } from "@/components/dashboard/user-management";

export const metadata = { title: "Team · Ads Dashboard" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = asRole(session.user.role);
  // Members can't manage users — bounce them back to the dashboard.
  if (!canManageUsers(role)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return (
    <UserManagement
      currentUserId={session.user.id}
      currentRole={role}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: asRole(u.role),
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
