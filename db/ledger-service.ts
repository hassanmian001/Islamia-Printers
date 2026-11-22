import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

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
} from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { endOfDayExclusive, normalizeEntryDate, parseDay } from "./dates.js";
import { runMigrations } from "./migrate.js";
import { loadJobsForSales } from "./sales-service.js";
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
    const jobsBySale = loadJobsForSales(
      db,
      saleRows.map((row) => row.id),
    );

    // Same-day entries keep the order they were typed in, so a payment taken
    // before the day's bill shows above it, as on a paper khata.
    type Pending = { date: Date; createdAt: Date; order: number; build: (balanceCents: number) => LedgerEntryDto & { closingBalanceCents: number } };
    const pending: Pending[] = [
      ...saleRows.map((sale) => ({
        date: sale.saleDate,
        createdAt: sale.createdAt,
        order: sale.id,
        build: (balanceBefore: number) => {
          let running = balanceBefore;
          const jobs = (jobsBySale.get(sale.id) ?? []).map((job) => {
            running += job.totalAmountCents;
            return { ...job, balanceCents: running };
          });

          return {
            kind: "bill" as const,
            saleId: sale.id,
            billNumber: sale.billNumber,
            date: sale.saleDate,
            notes: sale.notes,
            jobs,
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
        order: payment.id,
        build: (balanceBefore: number) => ({
          kind: "payment" as const,
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          narration: payment.narration,
          amountCents: payment.amountCents,
          balanceCents: balanceBefore - payment.amountCents,
          closingBalanceCents: balanceBefore - payment.amountCents,
        }),
      })),
    ].sort((left, right) => left.date.getTime() - right.date.getTime() || left.createdAt.getTime() - right.createdAt.getTime() || left.order - right.order);

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
          narration: nullableTrimmed(input.narration),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
    });

    return {
      id: row.id,
      receiptNumber: row.receiptNumber,
      customerId: row.customerId,
      amountCents: row.amountCents,
      paymentDate: row.paymentDate,
      narration: row.narration,
    };
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

      tx.delete(payments).where(eq(payments.id, id)).run();
      tx.insert(auditLogs)
        .values({
          action: "payment.deleted",
          entityType: "payment",
          entityId: id,
          actorName: nullableTrimmed(actorName),
          details: JSON.stringify({ receiptNumber: row.receiptNumber, customerId: row.customerId, amountCents: row.amountCents, narration: row.narration }),
        })
        .run();
    });
  } finally {
    sqlite.close();
  }
}
