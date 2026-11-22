import { and, gte, lt, sql } from "drizzle-orm";

import { emptyWorkAmounts, workKinds } from "../src/lib/job-math.js";
import type { DashboardSummaryDto } from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { computeLedgerSummary } from "./ledger-service.js";
import { runMigrations } from "./migrate.js";
import { payments, saleJobs, sales } from "./schema.js";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfNextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function getDashboardSummary(databasePath?: string, now = new Date()): DashboardSummaryDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const salesBetween = (from: Date, to: Date) =>
      db
        .select({ total: sql<number>`coalesce(sum(${sales.totalAmountCents}), 0)`, count: sql<number>`count(*)` })
        .from(sales)
        .where(and(gte(sales.saleDate, from), lt(sales.saleDate, to)))
        .get() ?? { total: 0, count: 0 };

    const today = salesBetween(startOfDay(now), startOfNextDay(now));
    const month = salesBetween(startOfMonth(now), startOfNextMonth(now));

    const monthReceivedCents =
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
        .from(payments)
        .where(and(gte(payments.paymentDate, startOfMonth(now)), lt(payments.paymentDate, startOfNextMonth(now))))
        .get()?.total ?? 0;

    const workRow = db
      .select({
        rota: sql<number>`coalesce(sum(${saleJobs.rotaAmountCents}), 0)`,
        gto: sql<number>`coalesce(sum(${saleJobs.gtoAmountCents}), 0)`,
        cutting: sql<number>`coalesce(sum(${saleJobs.cuttingAmountCents}), 0)`,
        lamination: sql<number>`coalesce(sum(${saleJobs.laminationAmountCents}), 0)`,
        dye: sql<number>`coalesce(sum(${saleJobs.dyeAmountCents}), 0)`,
      })
      .from(saleJobs)
      .innerJoin(sales, sql`${saleJobs.saleId} = ${sales.id}`)
      .where(and(gte(sales.saleDate, startOfMonth(now)), lt(sales.saleDate, startOfNextMonth(now))))
      .get();

    const monthWorkTotals = emptyWorkAmounts();

    for (const kind of workKinds) {
      monthWorkTotals[kind] = workRow?.[kind] ?? 0;
    }

    const ledger = computeLedgerSummary(db);

    return {
      todaySalesCents: today.total,
      todayBillCount: today.count,
      monthSalesCents: month.total,
      monthBillCount: month.count,
      monthReceivedCents,
      totalReceivableCents: ledger.totalReceivableCents,
      customerCount: ledger.customers.length,
      monthWorkTotals,
      topReceivables: ledger.customers
        .filter((row) => row.balanceCents > 0)
        .sort((left, right) => right.balanceCents - left.balanceCents)
        .slice(0, 8)
        .map((row) => ({ customerId: row.customerId, customerName: row.customerName, phone: row.phone, balanceCents: row.balanceCents })),
    };
  } finally {
    sqlite.close();
  }
}
