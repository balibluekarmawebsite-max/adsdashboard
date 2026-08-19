// Phase 10.2 — extract a revenue DRAFT from an uploaded document.
//
// Spreadsheets (CSV/XLSX) are read to text and sent to the text model; images
// (screenshots) go to the vision model. The output is a DRAFT the user reviews
// and edits before saving — we never write an extracted number straight to the
// database. NOTE: uploads come only from authenticated Owner/Admin users, so
// the (older) xlsx reader is used within that trust boundary and only to pull
// cell values out to text.

import * as XLSX from "xlsx";
import { groqChat, getGroqVisionModel } from "./groq";

export interface RevenueDraftEntry {
  propertyCode: string;
  amount: number | null;
  month: number | null;
  year: number | null;
  note: string | null;
}

export interface PropertyRef {
  code: string;
  name: string;
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif"];
const SHEET_EXT = ["csv", "tsv", "xlsx", "xls"];

export type FileKind = "image" | "sheet" | "unknown";

export function fileKind(name: string, mime: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  if (
    mime.includes("csv") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    SHEET_EXT.includes(ext)
  )
    return "sheet";
  return "unknown";
}

/** Read a spreadsheet/CSV buffer to a compact text table (capped for tokens). */
export function sheetToText(buf: Buffer, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "tsv") return buf.toString("utf8").slice(0, 20_000);
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.SheetNames.map((n) => `# Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
    .join("\n\n")
    .slice(0, 20_000);
}

function extractionSystemPrompt(properties: PropertyRef[]): string {
  const list = properties.map((p) => `${p.code} (${p.name})`).join(", ");
  return [
    "You extract monthly revenue figures from a business document for a Bali hospitality group.",
    `The properties and their codes are: ${list}.`,
    "From the provided content, find the revenue amount for each property you can identify.",
    "Return ONLY a JSON object of exactly this shape:",
    '{"entries":[{"propertyCode":"<one of the codes>","amount":<number>,"month":<1-12 or null>,"year":<4-digit year or null>,"note":<short label from the document or null>}]}',
    "Rules:",
    "- Use ONLY numbers present in the document. Never invent, estimate, or round.",
    "- Strip currency symbols and separators: 'Rp 150.000.000' or '150,000,000' -> 150000000.",
    "- Amounts are in IDR.",
    "- Match each figure to a property by its code or name. If a property is absent, omit it.",
    '- If you find no revenue at all, return {"entries":[]}.',
  ].join("\n");
}

function parseEntries(text: string, properties: PropertyRef[]): RevenueDraftEntry[] {
  const codes = new Set(properties.map((p) => p.code.toUpperCase()));
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const container = obj as { entries?: unknown };
  const arr = Array.isArray(container?.entries) ? container.entries : Array.isArray(obj) ? obj : [];
  const out: RevenueDraftEntry[] = [];
  for (const raw of arr as unknown[]) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const code = String(e.propertyCode ?? "").toUpperCase();
    if (!codes.has(code)) continue;
    const amount = Number(e.amount);
    const month = Number(e.month);
    const year = Number(e.year);
    out.push({
      propertyCode: code,
      amount: Number.isFinite(amount) && amount >= 0 ? amount : null,
      month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
      year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
      note: typeof e.note === "string" ? e.note.slice(0, 120) : null,
    });
  }
  return out;
}

export interface ExtractResult {
  entries: RevenueDraftEntry[];
  model: string;
  tokenUsage: number;
}

export async function extractRevenueDraft(
  input: { text?: string; imageDataUrl?: string },
  properties: PropertyRef[],
): Promise<ExtractResult> {
  const system = extractionSystemPrompt(properties);

  const result = input.imageDataUrl
    ? await groqChat(
        [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the revenue per property from this image." },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ],
          },
        ],
        { model: getGroqVisionModel(), temperature: 0 },
      )
    : await groqChat(
        [
          { role: "system", content: system },
          { role: "user", content: `Document content:\n\n${input.text ?? ""}` },
        ],
        { temperature: 0, responseFormatJson: true },
      );

  return { entries: parseEntries(result.text, properties), model: result.model, tokenUsage: result.tokenUsage };
}
