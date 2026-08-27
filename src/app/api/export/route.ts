import { requireSession } from "@/lib/api/guard";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { parseMetricsParams } from "@/lib/metrics/query";
import { buildReport, reportSlug } from "@/lib/export/report";
import { reportToXlsx } from "@/lib/export/xlsx";
import { reportToPptx } from "@/lib/export/pptx";

export const runtime = "nodejs";
export const maxDuration = 120;

function fileResponse(buf: Buffer, filename: string, contentType: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// GET /api/export?format=xlsx|pptx&from&to&property&platform
// Streams a spreadsheet or slide deck of the current report view as a download.
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
    const filter = await parseMetricsParams(url.searchParams);
    const model = await buildReport(filter);
    const slug = reportSlug(model);

    if (format === "xlsx") {
      return fileResponse(
        reportToXlsx(model),
        `ads-report_${slug}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    }
    if (format === "pptx") {
      return fileResponse(
        await reportToPptx(model),
        `ads-report_${slug}.pptx`,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
    }
    throw new ApiError(400, "Unknown export format — use xlsx or pptx.");
  } catch (err) {
    return errorResponse(err);
  }
}
