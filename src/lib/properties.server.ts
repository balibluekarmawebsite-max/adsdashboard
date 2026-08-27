import { prisma } from "@/lib/db";
import type { PropertyOption } from "@/lib/properties";

// Server-only: the active properties (hotels + outlets) every dashboard picker
// renders. Imported by server components only, so prisma never reaches the
// client bundle.
export async function listPropertyOptions(): Promise<PropertyOption[]> {
  const rows = await prisma.property.findMany({
    where: { active: true },
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
