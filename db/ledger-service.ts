import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { emptyWorkAmounts, sumWorkAmounts, workKinds } from "../src/lib/job-math.js";
import type {
  BusinessDocumentSettingsDto,
  LedgerCustomerSummaryDto,
  LedgerEntryDto,
  LedgerFilters,
  LedgerStatementDto,
  LedgerSummaryDto,
  PaymentDto,
  PaymentInput,
  PaymentListFilters,
  PaymentListItemDto,
  PaymentMethod,
} from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { endOfDayExclusive, normalizeEntryDate, parseDay } from "./dates.js";
import { runMigrations } from "./migrate.js";
import { loadItemsForSales, loadJobsForSales } from "./sales-service.js";
import { auditLogs, customers, payments, sales } from "./schema.js";
import { getBusinessSettings } from "./settings-service.js";

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

type Db = ReturnType<typeof createDb>["db"];

function nullableTrimmed(value: string | null | undefined) {
  return value?.trim() || null;
}

function parseFilterDay(value: string | null | undefined) {
  try {
    return { start: parseDay(value), end: endOfDayExclusive(value) };
  } catch (error) {
    throw new LedgerValidationError(error instanceof Error ? error.message : "Date is not valid.");
  }
}

function billNumbersFor(db: Db, saleIds: Array<number | null>): Map<number, number> {
  const ids = [...new Set(saleIds.filter((id): id is number => id !== null))];

  if (ids.length === 0) {
    return new Map();
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

function toPaymentDto(row: typeof payments.$inferSelect): PaymentDto {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    customerId: row.customerId,
    amountCents: row.amountCents,
    paymentDate: row.paymentDate,
    method: row.method,
    narration: row.narration,
    saleId: row.saleId,
  };
}

function customerSummaries(db: Db): LedgerCustomerSummaryDto[] {
  const billed = new Map(
    db
      .select({ customerId: sales.customerId, total: sql<number>`coalesce(sum(${sales.totalAmountCents}), 0)`, last: sql<number | null>`max(${sales.saleDate})` })
      .from(sales)
      .groupBy(sales.customerId)
      .all()
      .map((row) => [row.customerId, row]),
  );
  const received = new Map(
    db
      .select({ customerId: payments.customerId, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`, last: sql<number | null>`max(${payments.paymentDate})` })
      .from(payments)
      .groupBy(payments.customerId)
      .all()
      .map((row) => [row.customerId, row]),
  );

  return db
    .select()
    .from(customers)
    .orderBy(asc(customers.name))
    .all()
    .map((customer) => {
      const bill = billed.get(customer.id);
      const payment = received.get(customer.id);
      const billedCents = bill?.total ?? 0;
      const receivedCents = payment?.total ?? 0;
      const last = Math.max(bill?.last ?? 0, payment?.last ?? 0);

      return {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        openingBalanceCents: customer.openingBalanceCents,
        billedCents,
        receivedCents,
        balanceCents: customer.openingBalanceCents + billedCents - receivedCents,
        lastActivityDate: last > 0 ? new Date(last) : null,
      };
    });
}

export function computeLedgerSummary(db: Db): LedgerSummaryDto {
  const rows = customerSummaries(db);

  return {
    customers: rows,
    totalReceivableCents: rows.reduce((sum, row) => sum + Math.max(row.balanceCents, 0), 0),
  };
}

export function getLedgerSummary(databasePath?: string): LedgerSummaryDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return computeLedgerSummary(db);
  } finally {
    sqlite.close();
  }
}

function toDocumentSettings(databasePath: string | undefined): BusinessDocumentSettingsDto {
  const { businessName, phone, email, address, currencySymbol } = getBusinessSettings(databasePath);

  return { businessName, phone, email, address, currencySymbol };
}

/**
 * The khata of one customer, like a printed statement of account: the balance
 * brought forward to the first day asked for, then every bill (one line per job,
 * closed by a sub-total) and every payment in date order, each with the running
 * balance after it.
 */
export function getLedgerStatement(databasePath: string | undefined, customerId: number, filters: LedgerFilters = {}): LedgerStatementDto {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new LedgerValidationError("Customer must be selected.");
  }

  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();

    if (customer === undefined) {
      throw new LedgerValidationError("Customer was not found.");
    }

    const start = parseFilterDay(filters.startDate).start;
    const end = parseFilterDay(filters.endDate).end;

    if (start !== null && end !== null && end <= start) {
      throw new LedgerValidationError("The from date must be on or before the to date.");
    }

    let openingBalanceCents = customer.openingBalanceCents;

    if (start !== null) {
      const billedBefore =
        db
          .select({ total: sql<number>`coalesce(sum(${sales.totalAmountCents}), 0)` })
          .from(sales)
          .where(and(eq(sales.customerId, customerId), lt(sales.saleDate, start)))
          .get()?.total ?? 0;
      const receivedBefore =
        db
          .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
          .from(payments)
          .where(and(eq(payments.customerId, customerId), lt(payments.paymentDate, start)))
          .get()?.total ?? 0;

      openingBalanceCents += billedBefore - receivedBefore;
    }

    const saleConditions = [eq(sales.customerId, customerId)];
    const paymentConditions = [eq(payments.customerId, customerId)];

    if (start !== null) {
      saleConditions.push(gte(sales.saleDate, start));
      paymentConditions.push(gte(payments.paymentDate, start));
    }

    if (end !== null) {
      saleConditions.push(lt(sales.saleDate, end));
      paymentConditions.push(lt(payments.paymentDate, end));
    }

    const saleRows = db.select().from(sales).where(and(...saleConditions)).all();
    const paymentRows = db.select().from(payments).where(and(...paymentConditions)).all();
    const saleIds = saleRows.map((row) => row.id);
    const jobsBySale = loadJobsForSales(db, saleIds);
    const itemsBySale = loadItemsForSales(db, saleIds);
    const advanceBills = billNumbersFor(
      db,
      paymentRows.map((row) => row.saleId),
    );

    // Same-day entries keep the order they were typed in, so a payment taken
    // before the day's bill shows above it, as on a paper khata.
    type Pending = { date: Date; createdAt: Date; rank: number; order: number; build: (balanceCents: number) => LedgerEntryDto & { closingBalanceCents: number } };
    const pending: Pending[] = [
      ...saleRows.map((sale) => ({
        date: sale.saleDate,
        createdAt: sale.createdAt,
        rank: 0,
        order: sale.id,
        build: (balanceBefore: number) => {
          let running = balanceBefore;
          const jobs = (jobsBySale.get(sale.id) ?? []).map((job) => {
            running += job.totalAmountCents;
            return { ...job, balanceCents: running };
          });
          const items = (itemsBySale.get(sale.id) ?? []).map((item) => {
            running += item.amountCents;
            return { ...item, balanceCents: running };
          });

          return {
            kind: "bill" as const,
            saleKind: sale.kind,
            saleId: sale.id,
            billNumber: sale.billNumber,
            date: sale.saleDate,
            notes: sale.notes,
            jobs,
            items,
            workTotals: sumWorkAmounts(jobs),
            totalAmountCents: sale.totalAmountCents,
            balanceCents: balanceBefore + sale.totalAmountCents,
            closingBalanceCents: balanceBefore + sale.totalAmountCents,
          };
        },
      })),
      ...paymentRows.map((payment) => ({
        date: payment.paymentDate,
        createdAt: payment.createdAt,
        rank: 1,
        order: payment.id,
        build: (balanceBefore: number) => ({
          kind: "payment" as const,
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          method: payment.method,
          narration: payment.narration,
          billNumber: payment.saleId === null ? null : (advanceBills.get(payment.saleId) ?? null),
          amountCents: payment.amountCents,
          balanceCents: balanceBefore - payment.amountCents,
          closingBalanceCents: balanceBefore - payment.amountCents,
        }),
      })),
    ].sort((left, right) => left.date.getTime() - right.date.getTime() || left.createdAt.getTime() - right.createdAt.getTime() || left.rank - right.rank || left.order - right.order);

    let balanceCents = openingBalanceCents;
    const entries: LedgerEntryDto[] = pending.map((item) => {
      const { closingBalanceCents, ...entry } = item.build(balanceCents);
      balanceCents = closingBalanceCents;
      return entry;
    });

    const workTotals = emptyWorkAmounts();
    let debitCents = 0;
    let creditCents = 0;

    for (const entry of entries) {
      if (entry.kind === "bill") {
        debitCents += entry.totalAmountCents;

        for (const kind of workKinds) {
          workTotals[kind] += entry.workTotals[kind];
        }
      } else {
        creditCents += entry.amountCents;
      }
    }

    return {
      customer: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address },
      startDate: filters.startDate?.trim() || null,
      endDate: filters.endDate?.trim() || null,
      openingBalanceCents,
      entries,
      workTotals,
      debitCents,
      creditCents,
      closingBalanceCents: balanceCents,
      business: toDocumentSettings(databasePath),
      generatedAt: new Date(),
    };
  } finally {
    sqlite.close();
  }
}

function nextReceiptNumberIn(db: Db | Parameters<Parameters<Db["transaction"]>[0]>[0]) {
  const row = db.select({ max: sql<number | null>`max(${payments.receiptNumber})` }).from(payments).get();

  return (row?.max ?? 0) + 1;
}

export function getNextReceiptNumber(databasePath?: string): number {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return nextReceiptNumberIn(db);
  } finally {
    sqlite.close();
  }
}

export function recordPayment(databasePath: string | undefined, input: PaymentInput): PaymentDto {
  if (!Number.isInteger(input.customerId) || input.customerId <= 0) {
    throw new LedgerValidationError("Customer must be selected.");
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new LedgerValidationError("Payment amount must be more than zero.");
  }

  const method: PaymentMethod = input.method ?? "cash";

  if (method !== "cash" && method !== "online") {
    throw new LedgerValidationError("Payment must be received in cash or online.");
  }

  let paymentDate: Date;

  try {
    paymentDate = normalizeEntryDate(input.paymentDate, "Payment date");
  } catch (error) {
    throw new LedgerValidationError(error instanceof Error ? error.message : "Payment date is required.");
  }

  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const row = db.transaction((tx) => {
      const customer = tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).get();

      if (customer === undefined) {
        throw new LedgerValidationError("Customer was not found.");
      }

      return tx
        .insert(payments)
        .values({
          receiptNumber: nextReceiptNumberIn(tx),
          customerId: input.customerId,
          paymentDate,
          amountCents: input.amountCents,
          method,
          narration: nullableTrimmed(input.narration),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
    });

    return toPaymentDto(row);
  } finally {
    sqlite.close();
  }
}

/** Every payment received, newest first, with whose it is and the bill an advance was taken with. */
export function listPayments(databasePath?: string, filters: PaymentListFilters = {}): PaymentListItemDto[] {
  const start = parseFilterDay(filters.startDate).start;
  const end = parseFilterDay(filters.endDate).end;

  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const conditions = [];

    if (filters.customerId !== null && filters.customerId !== undefined) {
      conditions.push(eq(payments.customerId, filters.customerId));
    }

    if (filters.method) {
      conditions.push(eq(payments.method, filters.method));
    }

    if (start !== null) {
      conditions.push(gte(payments.paymentDate, start));
    }

    if (end !== null) {
      conditions.push(lt(payments.paymentDate, end));
    }

    const rows = db
      .select({ payment: payments, customerName: customers.name })
      .from(payments)
      .innerJoin(customers, eq(payments.customerId, customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payments.paymentDate), desc(payments.receiptNumber))
      .all();
    const bills = billNumbersFor(
      db,
      rows.map((row) => row.payment.saleId),
    );

    return rows.map((row) => ({
      ...toPaymentDto(row.payment),
      customerName: row.customerName,
      billNumber: row.payment.saleId === null ? null : (bills.get(row.payment.saleId) ?? null),
    }));
  } finally {
    sqlite.close();
  }
}

export function deletePayment(databasePath: string | undefined, id: number, actorName?: string | null): void {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    db.transaction((tx) => {
      const row = tx.select().from(payments).where(eq(payments.id, id)).get();

      if (row === undefined) {
        throw new LedgerValidationError("Payment was not found.");
      }

      // An advance belongs to its bill; it is changed or removed by editing that bill.
      if (row.saleId !== null) {
        throw new LedgerValidationError("This is the advance taken with a bill. Edit the bill to change or remove it.");
      }

      tx.delete(payments).where(eq(payments.id, id)).run();
      tx.insert(auditLogs)
        .values({
          action: "payment.deleted",
          entityType: "payment",
          entityId: id,
          actorName: nullableTrimmed(actorName),
          details: JSON.stringify({ receiptNumber: row.receiptNumber, customerId: row.customerId, amountCents: row.amountCents, method: row.method, narration: row.narration }),
        })
        .run();
    });
  } finally {
    sqlite.close();
  }
}
