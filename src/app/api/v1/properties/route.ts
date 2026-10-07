import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/api/key";
import { errorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/properties — the property catalogue, so a consumer can map codes
// to names and see the hotel → outlet/wellness hierarchy. API-key protected.
export async function GET(request: Request) {
  try {
    requireApiKey(request);
    const rows = await prisma.property.findMany({
      where: { active: true },
      orderBy: [{ code: "asc" }],
      select: { code: true, name: true, kind: true, parent: { select: { code: true } } },
    });
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      properties: rows.map((p) => ({
        code: p.code,
        name: p.name,
        kind: p.kind, // hotel | restaurant | spa | wellness
        parentCode: p.parent?.code ?? null, // null = top-level (hotel / wellness unit)
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
