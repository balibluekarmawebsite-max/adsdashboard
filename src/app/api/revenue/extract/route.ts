import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { asRole, canManageRevenue } from "@/lib/rbac";
import { fileKind, sheetToText, extractRevenueDraft } from "@/lib/ai/extract";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// POST /api/revenue/extract — multipart upload of a CSV/Excel/image. Returns a
// DRAFT extraction (never saved) for the user to review and confirm.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "Unauthorized");
    if (!canManageRevenue(asRole(session.user.role)))
      throw new ApiError(403, "Owners and Admins only");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file uploaded");
    if (file.size === 0) throw new ApiError(400, "The file is empty");
    if (file.size > MAX_BYTES) throw new ApiError(400, "File too large (max 8 MB)");

    const kind = fileKind(file.name, file.type);
    if (kind === "unknown")
      throw new ApiError(400, "Unsupported file type — upload a CSV, Excel, or image file.");

    const buf = Buffer.from(await file.arrayBuffer());
    const properties = await prisma.property.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });

    const draft =
      kind === "image"
        ? await extractRevenueDraft(
            { imageDataUrl: `data:${file.type || "image/png"};base64,${buf.toString("base64")}` },
            properties,
          )
        : await extractRevenueDraft({ text: sheetToText(buf, file.name) }, properties);

    return NextResponse.json({ ...draft, fileName: file.name, kind });
  } catch (err) {
    return errorResponse(err);
  }
}
