import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import { sumWorkAmounts } from "../src/lib/job-math.js";
import type { ReportFilters, ReportsDto, SalesReportRowDto } from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { endOfDayExclusive, parseDay } from "./dates.js";
import { runMigrations } from "./migrate.js";
import { loadJobsForSales } from "./sales-service.js";
import { customers, payments, sales } from "./schema.js";

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportValidationError";
  }
}

/** Every job sold in the date range, one row each, with totals per kind of work. */
export function getReports(databasePath?: string, filters: ReportFilters = {}): ReportsDto {
  let start: Date | null;
  let end: Date | null;

  try {
    start = parseDay(filters.startDate);
    end = endOfDayExclusive(filters.endDate);
  } catch (error) {
    throw new ReportValidationError(error instanceof Error ? error.message : "Date is not valid.");
  }

  if (start !== null && end !== null && end <= start) {
    throw new ReportValidationError("The from date must be on or before the to date.");
  }

  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const saleConditions = [];
    const paymentConditions = [];

    if (start !== null) {
      saleConditions.push(gte(sales.saleDate, start));
      paymentConditions.push(gte(payments.paymentDate, start));
    }

    if (end !== null) {
      saleConditions.push(lt(sales.saleDate, end));
      paymentConditions.push(lt(payments.paymentDate, end));
    }

    if (filters.customerId !== null && filters.customerId !== undefined) {
      saleConditions.push(eq(sales.customerId, filters.customerId));
      paymentConditions.push(eq(payments.customerId, filters.customerId));
    }

    const bills = db
      .select({ id: sales.id, billNumber: sales.billNumber, saleDate: sales.saleDate, customerName: customers.name })
      .from(sales)
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .where(saleConditions.length > 0 ? and(...saleConditions) : undefined)
      .orderBy(asc(sales.saleDate), asc(sales.billNumber))
      .all();

    const jobsBySale = loadJobsForSales(
      db,
      bills.map((bill) => bill.id),
    );

    const rows: SalesReportRowDto[] = bills.flatMap((bill) =>
      (jobsBySale.get(bill.id) ?? []).map((job) => ({
        saleId: bill.id,
        billNumber: bill.billNumber,
        saleDate: bill.saleDate,
        customerName: bill.customerName,
        jobName: job.jobName,
        totalAmountCents: job.totalAmountCents,
        rota: job.rota,
        gto: job.gto,
        cutting: job.cutting,
        lamination: job.lamination,
        dye: job.dye,
      })),
    );

    const receivedCents =
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
        .from(payments)
        .where(paymentConditions.length > 0 ? and(...paymentConditions) : undefined)
        .get()?.total ?? 0;

    return {
      filters,
      rows,
      workTotals: sumWorkAmounts(rows),
      salesTotalCents: rows.reduce((sum, row) => sum + row.totalAmountCents, 0),
      billCount: bills.length,
      jobCount: rows.length,
      receivedCents,
    };
  } finally {
    sqlite.close();
  }
}
