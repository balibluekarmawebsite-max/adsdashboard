import { prisma } from "@/lib/db";
import type { PropertyOption } from "@/lib/properties";
import { allowedPropertyIds } from "@/lib/auth/scope";

// Server-only: the active properties (hotels + outlets) every dashboard picker
// renders, scoped to what the signed-in user may see. Imported by server
// components only, so prisma never reaches the client bundle.
export async function listPropertyOptions(): Promise<PropertyOption[]> {
  const allowed = await allowedPropertyIds();
  const rows = await prisma.property.findMany({
    where: { active: true, ...(allowed ? { id: { in: allowed } } : {}) },
    orderBy: { code: "asc" },
    select: { code: true, name: true, kind: true, parent: { select: { code: true } } },
  });
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    kind: p.kind,
    parentCode: p.parent?.code ?? null,
  }));
}
