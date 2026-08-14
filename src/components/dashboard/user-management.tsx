"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { assignableRoles, canModifyUser, ROLE_LABEL, type Role } from "@/lib/rbac";
import { createUser, deleteUser, updateUserRole, type UserActionState } from "@/lib/users/actions";

interface Row {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

const ROLE_BADGE: Record<Role, string> = {
  OWNER: "bg-primary/10 text-primary ring-primary/25",
  ADMIN: "bg-brand-sky/20 text-brand-blue ring-brand-sky/40",
  MEMBER: "bg-muted text-muted-foreground ring-border",
};

/** Client-side random password so the admin has something to hand the new user. */
function randomPassword(len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

export function UserManagement({
  currentUserId,
  currentRole,
  users,
}: {
  currentUserId: string;
  currentRole: Role;
  users: Row[];
}) {
  const router = useRouter();
  const assignable = assignableRoles(currentRole);
  const canReassign = assignable.length > 1; // only Owners can change roles

  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [addState, setAddState] = useState<UserActionState>();
  const [adding, startAdd] = useTransition();
  const [rowMsg, setRowMsg] = useState<UserActionState>();
  const [rowBusy, startRow] = useTransition();

  function addUser(formData: FormData) {
    setAddState(undefined);
    startAdd(async () => {
      const res = await createUser(undefined, formData);
      setAddState(res);
      if (res?.success) {
        // Clear the form and pull the refreshed list.
        formRef.current?.reset();
        setPassword("");
        router.refresh();
      }
    });
  }

  function changeRole(id: string, role: Role) {
    setRowMsg(undefined);
    startRow(async () => {
      const res = await updateUserRole(id, role);
      setRowMsg(res);
      router.refresh();
    });
  }

  function remove(id: string, email: string) {
    if (!window.confirm(`Remove ${email}? This can't be undone.`)) return;
    setRowMsg(undefined);
    startRow(async () => {
      const res = await deleteUser(id);
      setRowMsg(res);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Team</h2>
        <p className="text-muted-foreground text-sm">
          Manage who can access the dashboard.{" "}
          {currentRole === "OWNER"
            ? "As Owner you can add Admins and Members and change anyone's role."
            : "As Admin you can add and remove Members."}
        </p>
      </div>

      {/* Add a user */}
      <section className="border-border bg-card rounded-xl border p-5">
        <h3 className="mb-4 text-sm font-semibold">Add a user</h3>
        <form ref={formRef} action={addUser} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Full name" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="name@bluekarmasecrets.com"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue={assignable[assignable.length - 1]}
              className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                name="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setPassword(randomPassword())}
              >
                Generate
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Share this with the user so they can sign in.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={adding}>
              <Plus className="mr-1.5 size-4" />
              {adding ? "Adding…" : "Add user"}
            </Button>
            {addState?.error && (
              <span className="text-destructive text-sm">{addState.error}</span>
            )}
            {addState?.success && (
              <span className="text-sm text-[color:var(--chart-3)]">{addState.success}</span>
            )}
          </div>
        </form>
      </section>

      {/* Users list */}
      <section className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h3 className="text-sm font-semibold">Users ({users.length})</h3>
          {rowMsg?.error && <span className="text-destructive text-xs">{rowMsg.error}</span>}
          {rowMsg?.success && (
            <span className="text-muted-foreground text-xs">{rowMsg.success}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-t text-left text-xs tracking-wide uppercase">
                <th className="px-5 py-2 font-medium">User</th>
                <th className="px-5 py-2 font-medium">Role</th>
                <th className="px-5 py-2 font-medium">Added</th>
                <th className="px-5 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const canEdit = !isSelf && canModifyUser(currentRole, u.role);
                return (
                  <tr key={u.id} className="border-border border-t">
                    <td className="px-5 py-3">
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                          ROLE_BADGE[u.role],
                        )}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                      {isSelf && <span className="text-muted-foreground ml-2 text-xs">you</span>}
                    </td>
                    <td className="text-muted-foreground px-5 py-3 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit ? (
                          <>
                            {canReassign && (
                              <select
                                aria-label={`Change role for ${u.email}`}
                                value={u.role}
                                disabled={rowBusy}
                                onChange={(e) => changeRole(u.id, e.target.value as Role)}
                                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                              >
                                {assignable.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABEL[r]}
                                  </option>
                                ))}
                              </select>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={rowBusy}
                              onClick={() => remove(u.id, u.email)}
                              aria-label={`Remove ${u.email}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
