import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

// Monthly revenue per property + the ad spend for that same month, so the
// revenue page can show ROAS (revenue ÷ spend) directly. Revenue is a property
// total for the month — not per platform — so ROAS here is blended.

export interface RevenueInput {
  propertyCode: string;
  year: number;
  month: number;
  amount: number;
  currency?: string;
  note?: string | null;
  source?: string | null;
}

export interface RevenueRow {
  id: string;
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  year: number;
  month: number;
  amount: number;
  currency: string;
  spend: number; // ad spend for this property in this month
  roas: number | null; // amount ÷ spend (null when no spend)
  note: string | null;
  source: string | null;
  updatedAt: string;
}

/** UTC first/last day of a calendar month (metrics_daily.date is a UTC date). */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)) };
}

/** Ad spend for one property across an inclusive [from, to] UTC-date range. */
async function spendForRange(propertyId: string, from: Date, to: Date): Promise<number> {
  const agg = await prisma.metricsDaily.aggregate({
    where: { propertyId, date: { gte: from, lte: to } },
    _sum: { spend: true },
  });
  return Number(agg._sum.spend ?? 0);
}

async function spendForMonth(propertyId: string, year: number, month: number): Promise<number> {
  const { from, to } = monthRange(year, month);
  return spendForRange(propertyId, from, to);
}

/** A Date (stored at UTC midnight for @db.Date) → "YYYY-MM-DD". */
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export async function listRevenue(): Promise<RevenueRow[]> {
  const rows = await prisma.revenueMonthly.findMany({
    include: { property: { select: { code: true, name: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { property: { code: "asc" } }],
  });
  return Promise.all(
    rows.map(async (r) => {
      const amount = Number(r.amount);
      const spend = await spendForMonth(r.propertyId, r.year, r.month);
      return {
        id: r.id,
        propertyId: r.propertyId,
        propertyCode: r.property.code,
        propertyName: r.property.name,
        year: r.year,
        month: r.month,
        amount,
        currency: r.currency.trim(),
        spend,
        roas: spend > 0 ? amount / spend : null,
        note: r.note,
        source: r.source,
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  );
}

/** Validate + coerce a raw revenue input; throws ApiError(400) on bad data. */
export function parseRevenueInput(raw: unknown): Required<Omit<RevenueInput, "note" | "source">> &
  Pick<RevenueInput, "note" | "source"> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const propertyCode = typeof o.propertyCode === "string" ? o.propertyCode.trim() : "";
  const year = Number(o.year);
  const month = Number(o.month);
  const amount = Number(o.amount);

  if (!propertyCode) throw new ApiError(400, "propertyCode is required");
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new ApiError(400, "year must be between 2000 and 2100");
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new ApiError(400, "month must be between 1 and 12");
  if (!Number.isFinite(amount) || amount < 0)
    throw new ApiError(400, "amount must be a number ≥ 0");

  const currency = (typeof o.currency === "string" && o.currency.trim() ? o.currency : "IDR")
    .toUpperCase()
    .slice(0, 3);
  const note = typeof o.note === "string" && o.note.trim() ? o.note.trim() : null;
  const source = typeof o.source === "string" && o.source.trim() ? o.source.trim() : null;

  return { propertyCode, year, month, amount, currency, note, source };
}

export async function upsertRevenue(input: RevenueInput) {
  const property = await prisma.property.findUnique({ where: { code: input.propertyCode } });
  if (!property) throw new ApiError(400, `Unknown property "${input.propertyCode}"`);
  const currency = (input.currency ?? "IDR").toUpperCase();
  return prisma.revenueMonthly.upsert({
    where: {
      propertyId_year_month: { propertyId: property.id, year: input.year, month: input.month },
    },
    create: {
      propertyId: property.id,
      year: input.year,
      month: input.month,
      amount: input.amount,
      currency,
      note: input.note ?? null,
      source: input.source ?? null,
    },
    update: { amount: input.amount, currency, note: input.note ?? null, source: input.source ?? null },
  });
}

export async function deleteRevenue(id: string): Promise<void> {
  await prisma.revenueMonthly.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Date-range (period) revenue — e.g. 21–27 Aug. Coexists with monthly revenue;
// see revenueForRange() for how the two blend when a report is generated.
// ---------------------------------------------------------------------------

export interface RevenuePeriodInput {
  id?: string; // present when editing an existing row in place
  propertyCode: string;
  startDate: Date;
  endDate: Date;
  amount: number;
  currency?: string;
  note?: string | null;
  source?: string | null;
}

export interface RevenuePeriodRow {
  id: string;
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (inclusive)
  amount: number;
  currency: string;
  spend: number; // ad spend for this property across the range
  roas: number | null; // amount ÷ spend (null when no spend)
  note: string | null;
  source: string | null;
  updatedAt: string;
}

export async function listRevenuePeriods(): Promise<RevenuePeriodRow[]> {
  const rows = await prisma.revenuePeriod.findMany({
    include: { property: { select: { code: true, name: true } } },
    orderBy: [{ startDate: "desc" }, { property: { code: "asc" } }],
  });
  return Promise.all(
    rows.map(async (r) => {
      const amount = Number(r.amount);
      const spend = await spendForRange(r.propertyId, r.startDate, r.endDate);
      return {
        id: r.id,
        propertyId: r.propertyId,
        propertyCode: r.property.code,
        propertyName: r.property.name,
        startDate: isoDate(r.startDate),
        endDate: isoDate(r.endDate),
        amount,
        currency: r.currency.trim(),
        spend,
        roas: spend > 0 ? amount / spend : null,
        note: r.note,
        source: r.source,
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a "YYYY-MM-DD" string into a UTC-midnight Date; throws ApiError(400). */
function parseUtcDate(value: unknown, field: string): Date {
  const s = typeof value === "string" ? value.trim() : "";
  if (!DATE_RE.test(s)) throw new ApiError(400, `${field} must be a date (YYYY-MM-DD)`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `${field} is not a valid date`);
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100)
    throw new ApiError(400, `${field} year must be between 2000 and 2100`);
  return d;
}

/** Validate + coerce a raw date-range revenue input; throws ApiError(400). */
export function parseRevenuePeriodInput(raw: unknown): RevenuePeriodInput {
  const o = (raw ?? {}) as Record<string, unknown>;
  const propertyCode = typeof o.propertyCode === "string" ? o.propertyCode.trim() : "";
  if (!propertyCode) throw new ApiError(400, "propertyCode is required");

  const startDate = parseUtcDate(o.startDate, "startDate");
  const endDate = parseUtcDate(o.endDate, "endDate");
  if (endDate.getTime() < startDate.getTime())
    throw new ApiError(400, "endDate must be on or after startDate");

  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount < 0)
    throw new ApiError(400, "amount must be a number ≥ 0");

  const currency = (typeof o.currency === "string" && o.currency.trim() ? o.currency : "IDR")
    .toUpperCase()
    .slice(0, 3);
  const note = typeof o.note === "string" && o.note.trim() ? o.note.trim() : null;
  const source = typeof o.source === "string" && o.source.trim() ? o.source.trim() : null;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;

  return { id, propertyCode, startDate, endDate, amount, currency, note, source };
}

export async function upsertRevenuePeriod(input: RevenuePeriodInput) {
  const property = await prisma.property.findUnique({ where: { code: input.propertyCode } });
  if (!property) throw new ApiError(400, `Unknown property "${input.propertyCode}"`);
  const currency = (input.currency ?? "IDR").toUpperCase();
  const data = {
    startDate: input.startDate,
    endDate: input.endDate,
    amount: input.amount,
    currency,
    note: input.note ?? null,
    source: input.source ?? null,
  };

  try {
    // Editing in place (id given) can change the date range too, so update by id.
    if (input.id) {
      return await prisma.revenuePeriod.update({
        where: { id: input.id },
        data: { ...data, propertyId: property.id },
      });
    }
    return await prisma.revenuePeriod.upsert({
      where: {
        propertyId_startDate_endDate: {
          propertyId: property.id,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      },
      create: { propertyId: property.id, ...data },
      update: data,
    });
  } catch (err) {
    // Unique violation: a period with the same property + exact dates exists.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new ApiError(409, "A revenue entry for that property and date range already exists.");
    }
    throw err;
  }
}

export async function deleteRevenuePeriod(id: string): Promise<void> {
  await prisma.revenuePeriod.delete({ where: { id } });
}
