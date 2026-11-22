import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { jobTotalCents, workAmountCents, workKinds, type WorkKind } from "../src/lib/job-math.js";
import type { SaleDetailDto, SaleHistoryDto, SaleInput, SaleJobDto, SaleListFilters } from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { endOfDayExclusive, normalizeEntryDate, parseDay } from "./dates.js";
import { runMigrations } from "./migrate.js";
import { auditLogs, customers, saleJobs, sales } from "./schema.js";

export class SaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleValidationError";
  }
}

type Db = ReturnType<typeof createDb>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbClient = Db | Tx;
type SaleJobRow = typeof saleJobs.$inferSelect;

const columnsByKind = {
  rota: { qty: "rotaQty", rate: "rotaRateCents", amount: "rotaAmountCents" },
  gto: { qty: "gtoQty", rate: "gtoRateCents", amount: "gtoAmountCents" },
  cutting: { qty: "cuttingQty", rate: "cuttingRateCents", amount: "cuttingAmountCents" },
  lamination: { qty: "laminationQty", rate: "laminationRateCents", amount: "laminationAmountCents" },
  dye: { qty: "dyeQty", rate: "dyeRateCents", amount: "dyeAmountCents" },
} as const satisfies Record<WorkKind, { qty: keyof SaleJobRow; rate: keyof SaleJobRow; amount: keyof SaleJobRow }>;

const workNames: Record<WorkKind, string> = {
  rota: "Rota P",
  gto: "GTO P",
  cutting: "Cutting",
  lamination: "Lamination",
  dye: "Dye",
};

function nullableTrimmed(value: string | null | undefined) {
  return value?.trim() || null;
}

function validateId(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SaleValidationError(`${label} must be selected.`);
  }
}

function normalizeSaleInput(input: SaleInput) {
  validateId(input.customerId, "Customer");

  let saleDate: Date;

  try {
    saleDate = normalizeEntryDate(input.saleDate, "Sale date");
  } catch (error) {
    throw new SaleValidationError(error instanceof Error ? error.message : "Sale date is required.");
  }

  if (!Array.isArray(input.jobs) || input.jobs.length === 0) {
    throw new SaleValidationError("Add at least one job to the bill.");
  }

  const jobs = input.jobs.map((job, index) => {
    const jobName = job.jobName?.trim() ?? "";
    const label = jobName ? `"${jobName}"` : `Job ${index + 1}`;

    if (!jobName) {
      throw new SaleValidationError(`Job ${index + 1} needs a job name.`);
    }

    const values: Partial<Record<keyof SaleJobRow, number>> = {};

    for (const kind of workKinds) {
      const charge = job[kind] ?? { qty: 0, rateCents: 0 };
      const qty = Number(charge.qty ?? 0);
      const rateCents = Number(charge.rateCents ?? 0);

      if (!Number.isFinite(qty) || qty < 0) {
        throw new SaleValidationError(`${label}: ${workNames[kind]} quantity cannot be negative.`);
      }

      if (!Number.isInteger(rateCents) || rateCents < 0) {
        throw new SaleValidationError(`${label}: ${workNames[kind]} rate must be an amount of zero or more.`);
      }

      if (rateCents > 0 && qty === 0) {
        throw new SaleValidationError(`${label}: ${workNames[kind]} has a rate but no quantity.`);
      }

      const columns = columnsByKind[kind];
      values[columns.qty] = qty;
      values[columns.rate] = rateCents;
      values[columns.amount] = workAmountCents({ qty, rateCents });
    }

    const totalAmountCents = jobTotalCents({
      rota: job.rota ?? { qty: 0, rateCents: 0 },
      gto: job.gto ?? { qty: 0, rateCents: 0 },
      cutting: job.cutting ?? { qty: 0, rateCents: 0 },
      lamination: job.lamination ?? { qty: 0, rateCents: 0 },
      dye: job.dye ?? { qty: 0, rateCents: 0 },
    });

    if (totalAmountCents <= 0) {
      throw new SaleValidationError(`${label} has no charges. Fill in a quantity and rate for at least one kind of work.`);
    }

    return { position: index, jobName, ...values, totalAmountCents };
  });

  return {
    customerId: input.customerId,
    saleDate,
    notes: nullableTrimmed(input.notes),
    jobs,
    totalAmountCents: jobs.reduce((sum, job) => sum + job.totalAmountCents, 0),
  };
}

type NormalizedSale = ReturnType<typeof normalizeSaleInput>;

/** Shapes a stored job row for the screens, with each kind of work as qty / rate / amount. */
export function toSaleJobDto(row: SaleJobRow): SaleJobDto {
  const charges = Object.fromEntries(
    workKinds.map((kind) => {
      const columns = columnsByKind[kind];

      return [kind, { qty: row[columns.qty] as number, rateCents: row[columns.rate] as number, amountCents: row[columns.amount] as number }];
    }),
  ) as Pick<SaleJobDto, WorkKind>;

  return {
    id: row.id,
    position: row.position,
    jobName: row.jobName,
    totalAmountCents: row.totalAmountCents,
    ...charges,
  };
}

export function loadJobsForSales(db: DbClient, saleIds: number[]): Map<number, SaleJobDto[]> {
  const bySale = new Map<number, SaleJobDto[]>();

  if (saleIds.length === 0) {
    return bySale;
  }

  for (const row of db.select().from(saleJobs).where(inArray(saleJobs.saleId, saleIds)).orderBy(asc(saleJobs.position), asc(saleJobs.id)).all()) {
    const list = bySale.get(row.saleId) ?? [];
    list.push(toSaleJobDto(row));
    bySale.set(row.saleId, list);
  }

  return bySale;
}

function getSaleDetail(db: DbClient, id: number): SaleDetailDto {
  const sale = db
    .select({
      id: sales.id,
      billNumber: sales.billNumber,
      customerId: sales.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      saleDate: sales.saleDate,
      totalAmountCents: sales.totalAmountCents,
      notes: sales.notes,
      createdAt: sales.createdAt,
      updatedAt: sales.updatedAt,
    })
    .from(sales)
    .innerJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.id, id))
    .get();

  if (sale === undefined) {
    throw new SaleValidationError("Bill was not found.");
  }

  return { ...sale, jobs: loadJobsForSales(db, [id]).get(id) ?? [] };
}

function assertCustomerExists(db: DbClient, customerId: number) {
  const customer = db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).get();

  if (customer === undefined) {
    throw new SaleValidationError("Customer was not found.");
  }
}

function nextBillNumberIn(db: DbClient) {
  const row = db.select({ max: sql<number | null>`max(${sales.billNumber})` }).from(sales).get();

  return (row?.max ?? 0) + 1;
}

function writeJobs(tx: DbClient, saleId: number, normalized: NormalizedSale) {
  for (const job of normalized.jobs) {
    tx.insert(saleJobs)
      .values({ ...(job as typeof saleJobs.$inferInsert), saleId })
      .run();
  }
}

export function getNextBillNumber(databasePath?: string): number {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return nextBillNumberIn(db);
  } finally {
    sqlite.close();
  }
}

/** Records a bill and its jobs together; if any job is rejected, nothing is saved. */
export function createSale(databasePath: string | undefined, input: SaleInput): SaleDetailDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const normalized = normalizeSaleInput(input);

    const saleId = db.transaction((tx) => {
      assertCustomerExists(tx, normalized.customerId);

      const inserted = tx
        .insert(sales)
        .values({
          billNumber: nextBillNumberIn(tx),
          customerId: normalized.customerId,
          saleDate: normalized.saleDate,
          totalAmountCents: normalized.totalAmountCents,
          notes: normalized.notes,
          // Millisecond precision, so same-day entries on the khata keep the order they were typed in.
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: sales.id })
        .get();

      writeJobs(tx, inserted.id, normalized);

      return inserted.id;
    });

    return getSaleDetail(db, saleId);
  } finally {
    sqlite.close();
  }
}

/** Replaces a bill's jobs and details in place; its bill number stays the same. */
export function updateSale(databasePath: string | undefined, id: number, input: SaleInput, actorName?: string | null): SaleDetailDto {
  validateId(id, "Bill");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const normalized = normalizeSaleInput(input);

    db.transaction((tx) => {
      const before = getSaleDetail(tx, id);
      assertCustomerExists(tx, normalized.customerId);

      tx.update(sales)
        .set({
          customerId: normalized.customerId,
          saleDate: normalized.saleDate,
          totalAmountCents: normalized.totalAmountCents,
          notes: normalized.notes,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, id))
        .run();

      tx.delete(saleJobs).where(eq(saleJobs.saleId, id)).run();
      writeJobs(tx, id, normalized);

      tx.insert(auditLogs)
        .values({
          action: "sale.updated",
          entityType: "sale",
          entityId: id,
          actorName: nullableTrimmed(actorName),
          details: JSON.stringify({
            billNumber: before.billNumber,
            before: { customerId: before.customerId, totalAmountCents: before.totalAmountCents, jobs: before.jobs.map((job) => job.jobName) },
            after: { customerId: normalized.customerId, totalAmountCents: normalized.totalAmountCents, jobs: normalized.jobs.map((job) => job.jobName) },
          }),
        })
        .run();
    });

    return getSaleDetail(db, id);
  } finally {
    sqlite.close();
  }
}

export function deleteSale(databasePath: string | undefined, id: number, actorName?: string | null): void {
  validateId(id, "Bill");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    db.transaction((tx) => {
      const before = getSaleDetail(tx, id);

      tx.delete(sales).where(eq(sales.id, id)).run();
      tx.insert(auditLogs)
        .values({
          action: "sale.deleted",
          entityType: "sale",
          entityId: id,
          actorName: nullableTrimmed(actorName),
          details: JSON.stringify({
            billNumber: before.billNumber,
            customerName: before.customerName,
            totalAmountCents: before.totalAmountCents,
            jobs: before.jobs.map((job) => job.jobName),
          }),
        })
        .run();
    });
  } finally {
    sqlite.close();
  }
}

export function getSale(databasePath: string | undefined, id: number): SaleDetailDto {
  validateId(id, "Bill");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return getSaleDetail(db, id);
  } finally {
    sqlite.close();
  }
}

export function listSales(databasePath?: string, filters: SaleListFilters = {}): SaleHistoryDto[] {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const conditions = [];
    const start = parseDay(filters.startDate);
    const end = endOfDayExclusive(filters.endDate);

    if (filters.customerId !== null && filters.customerId !== undefined) {
      conditions.push(eq(sales.customerId, filters.customerId));
    }

    if (start !== null) {
      conditions.push(gte(sales.saleDate, start));
    }

    if (end !== null) {
      conditions.push(lt(sales.saleDate, end));
    }

    const rows = db
      .select({
        id: sales.id,
        billNumber: sales.billNumber,
        customerId: sales.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        saleDate: sales.saleDate,
        totalAmountCents: sales.totalAmountCents,
        notes: sales.notes,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sales.saleDate), desc(sales.billNumber))
      .all();

    const jobsBySale = loadJobsForSales(
      db,
      rows.map((row) => row.id),
    );
    const search = filters.search?.trim().toLowerCase() ?? "";

    return rows
      .map((row) => {
        const jobNames = (jobsBySale.get(row.id) ?? []).map((job) => job.jobName);

        return { ...row, jobCount: jobNames.length, jobNames };
      })
      .filter(
        (row) =>
          search === "" ||
          String(row.billNumber) === search ||
          row.customerName.toLowerCase().includes(search) ||
          row.jobNames.some((name) => name.toLowerCase().includes(search)),
      );
  } finally {
    sqlite.close();
  }
}
