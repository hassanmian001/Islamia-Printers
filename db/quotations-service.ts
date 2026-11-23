import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { workAmountCents } from "../src/lib/job-math.js";
import type {
  CashSaleItemDto,
  ConvertQuotationInput,
  QuotationDetailDto,
  QuotationHistoryDto,
  QuotationInput,
  QuotationListFilters,
  SaleDetailDto,
} from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { endOfDayExclusive, normalizeEntryDate, parseDay } from "./dates.js";
import { runMigrations } from "./migrate.js";
import { createSaleIn, getSaleDetail, type DbClient } from "./sales-service.js";
import { customers, quotationItems, quotations, sales } from "./schema.js";

export class QuotationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotationValidationError";
  }
}

function nullableTrimmed(value: string | null | undefined) {
  return value?.trim() || null;
}

function validateId(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new QuotationValidationError(`${label} must be selected.`);
  }
}

function toDate(value: Date | string, label: string) {
  try {
    return normalizeEntryDate(value, label);
  } catch (error) {
    throw new QuotationValidationError(error instanceof Error ? error.message : `${label} is required.`);
  }
}

function normalizeQuotationInput(db: DbClient, input: QuotationInput) {
  let customerId: number | null = null;
  let customerName = nullableTrimmed(input.customerName);
  let customerPhone = nullableTrimmed(input.customerPhone);

  if (input.customerId !== null && input.customerId !== undefined) {
    validateId(input.customerId, "Customer");
    const customer = db.select().from(customers).where(eq(customers.id, input.customerId)).get();

    if (customer === undefined) {
      throw new QuotationValidationError("Customer was not found.");
    }

    // The quotation keeps the name and phone as they were when it was given.
    customerId = customer.id;
    customerName = customer.name;
    customerPhone = customer.phone;
  }

  if (!customerName) {
    throw new QuotationValidationError("Choose a customer or type the party's name.");
  }

  const quotationDate = toDate(input.quotationDate, "Quotation date");
  const validUntil = input.validUntil ? toDate(input.validUntil, "Valid till date") : null;

  if (validUntil !== null && validUntil < quotationDate) {
    throw new QuotationValidationError("Valid till cannot be before the quotation date.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new QuotationValidationError("Add at least one line to the quotation.");
  }

  const items = input.items.map((item, index) => {
    const description = item.description?.trim() ?? "";
    const label = description ? `"${description}"` : `Line ${index + 1}`;
    const qty = Number(item.qty ?? 0);
    const rateCents = Number(item.rateCents ?? 0);

    if (!description) {
      throw new QuotationValidationError(`Line ${index + 1} needs a description.`);
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new QuotationValidationError(`${label}: quantity must be more than zero.`);
    }

    if (!Number.isInteger(rateCents) || rateCents <= 0) {
      throw new QuotationValidationError(`${label}: rate must be more than zero.`);
    }

    return { position: index, description, qty, rateCents, amountCents: workAmountCents({ qty, rateCents }) };
  });

  return {
    customerId,
    customerName,
    customerPhone,
    quotationDate,
    validUntil,
    notes: nullableTrimmed(input.notes),
    items,
    totalAmountCents: items.reduce((sum, item) => sum + item.amountCents, 0),
  };
}

function loadItems(db: DbClient, ids: number[]): Map<number, CashSaleItemDto[]> {
  const byQuotation = new Map<number, CashSaleItemDto[]>();

  if (ids.length === 0) {
    return byQuotation;
  }

  for (const row of db.select().from(quotationItems).where(inArray(quotationItems.quotationId, ids)).orderBy(asc(quotationItems.position), asc(quotationItems.id)).all()) {
    const list = byQuotation.get(row.quotationId) ?? [];
    list.push({ id: row.id, position: row.position, description: row.description, qty: row.qty, rateCents: row.rateCents, amountCents: row.amountCents });
    byQuotation.set(row.quotationId, list);
  }

  return byQuotation;
}

function billNumbers(db: DbClient, saleIds: Array<number | null>) {
  const ids = [...new Set(saleIds.filter((id): id is number => id !== null))];

  if (ids.length === 0) {
    return new Map<number, number>();
  }

  return new Map(
    db
      .select({ id: sales.id, billNumber: sales.billNumber })
      .from(sales)
      .where(inArray(sales.id, ids))
      .all()
      .map((row) => [row.id, row.billNumber]),
  );
}

function toDto(row: typeof quotations.$inferSelect, items: CashSaleItemDto[], bills: Map<number, number>): QuotationDetailDto {
  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    quotationDate: row.quotationDate,
    validUntil: row.validUntil,
    totalAmountCents: row.totalAmountCents,
    notes: row.notes,
    items,
    convertedSaleId: row.convertedSaleId,
    convertedBillNumber: row.convertedSaleId === null ? null : (bills.get(row.convertedSaleId) ?? null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getDetail(db: DbClient, id: number): QuotationDetailDto {
  const row = db.select().from(quotations).where(eq(quotations.id, id)).get();

  if (row === undefined) {
    throw new QuotationValidationError("Quotation was not found.");
  }

  return toDto(row, loadItems(db, [id]).get(id) ?? [], billNumbers(db, [row.convertedSaleId]));
}

function nextNumberIn(db: DbClient) {
  const row = db.select({ max: sql<number | null>`max(${quotations.quotationNumber})` }).from(quotations).get();

  return (row?.max ?? 0) + 1;
}

function writeItems(tx: DbClient, quotationId: number, items: ReturnType<typeof normalizeQuotationInput>["items"]) {
  for (const item of items) {
    tx.insert(quotationItems)
      .values({ ...item, quotationId })
      .run();
  }
}

export function getNextQuotationNumber(databasePath?: string): number {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return nextNumberIn(db);
  } finally {
    sqlite.close();
  }
}

export function createQuotation(databasePath: string | undefined, input: QuotationInput): QuotationDetailDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const id = db.transaction((tx) => {
      const { items, ...values } = normalizeQuotationInput(tx, input);
      const inserted = tx
        .insert(quotations)
        .values({ ...values, quotationNumber: nextNumberIn(tx) })
        .returning({ id: quotations.id })
        .get();

      writeItems(tx, inserted.id, items);

      return inserted.id;
    });

    return getDetail(db, id);
  } finally {
    sqlite.close();
  }
}

/** Rewrites a quotation in place, keeping its number. A bill already made from it is not touched. */
export function updateQuotation(databasePath: string | undefined, id: number, input: QuotationInput): QuotationDetailDto {
  validateId(id, "Quotation");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    db.transaction((tx) => {
      getDetail(tx, id);
      const { items, ...values } = normalizeQuotationInput(tx, input);

      tx.update(quotations)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(quotations.id, id))
        .run();
      tx.delete(quotationItems).where(eq(quotationItems.quotationId, id)).run();
      writeItems(tx, id, items);
    });

    return getDetail(db, id);
  } finally {
    sqlite.close();
  }
}

export function deleteQuotation(databasePath: string | undefined, id: number): void {
  validateId(id, "Quotation");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const result = db.delete(quotations).where(eq(quotations.id, id)).run();

    if (result.changes === 0) {
      throw new QuotationValidationError("Quotation was not found.");
    }
  } finally {
    sqlite.close();
  }
}

export function getQuotation(databasePath: string | undefined, id: number): QuotationDetailDto {
  validateId(id, "Quotation");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return getDetail(db, id);
  } finally {
    sqlite.close();
  }
}

export function listQuotations(databasePath?: string, filters: QuotationListFilters = {}): QuotationHistoryDto[] {
  let start: Date | null;
  let end: Date | null;

  try {
    start = parseDay(filters.startDate);
    end = endOfDayExclusive(filters.endDate);
  } catch (error) {
    throw new QuotationValidationError(error instanceof Error ? error.message : "Date is not valid.");
  }

  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const conditions = [];

    if (start !== null) {
      conditions.push(gte(quotations.quotationDate, start));
    }

    if (end !== null) {
      conditions.push(lt(quotations.quotationDate, end));
    }

    const rows = db
      .select()
      .from(quotations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quotations.quotationDate), desc(quotations.quotationNumber))
      .all();
    const items = loadItems(
      db,
      rows.map((row) => row.id),
    );
    const bills = billNumbers(
      db,
      rows.map((row) => row.convertedSaleId),
    );
    const search = filters.search?.trim().toLowerCase() ?? "";

    return rows
      .map((row) => {
        const { items: lines, ...detail } = toDto(row, items.get(row.id) ?? [], bills);

        return { ...detail, itemCount: lines.length, itemNames: lines.map((line) => line.description) };
      })
      .filter(
        (row) =>
          search === "" ||
          String(row.quotationNumber) === search.replace(/^q-?/, "") ||
          row.customerName.toLowerCase().includes(search) ||
          (row.customerPhone ?? "").includes(search) ||
          row.itemNames.some((name) => name.toLowerCase().includes(search)),
      );
  } finally {
    sqlite.close();
  }
}

/**
 * Turns an agreed quotation into a cash sale bill on the party's khata, with
 * the same lines and any advance taken now. A party typed in by name is added
 * to Customers first, so the bill has a khata to sit on. Everything happens in
 * one transaction.
 */
export function convertQuotationToSale(databasePath: string | undefined, id: number, input: ConvertQuotationInput): SaleDetailDto {
  validateId(id, "Quotation");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const saleId = db.transaction((tx) => {
      const quotation = getDetail(tx, id);

      if (quotation.convertedSaleId !== null) {
        throw new QuotationValidationError(`This quotation is already Bill No. ${quotation.convertedBillNumber ?? "-"}.`);
      }

      let customerId = quotation.customerId;

      if (customerId === null) {
        customerId = tx
          .insert(customers)
          .values({ name: quotation.customerName, phone: quotation.customerPhone })
          .returning({ id: customers.id })
          .get().id;
      }

      const newSaleId = createSaleIn(tx, {
        kind: "cash",
        customerId,
        saleDate: input.saleDate,
        notes: quotation.notes ? `Quotation Q-${quotation.quotationNumber}: ${quotation.notes}` : `Quotation Q-${quotation.quotationNumber}`,
        items: quotation.items.map((item) => ({ description: item.description, qty: item.qty, rateCents: item.rateCents })),
        advanceCents: input.advanceCents ?? 0,
        advanceMethod: input.advanceMethod ?? "cash",
        advanceReference: input.advanceReference ?? null,
      });

      tx.update(quotations)
        .set({ customerId, convertedSaleId: newSaleId, updatedAt: new Date() })
        .where(eq(quotations.id, id))
        .run();

      return newSaleId;
    });

    return getSaleDetail(db, saleId);
  } finally {
    sqlite.close();
  }
}
