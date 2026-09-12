import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";

import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";
import { auditLogs, customers, payments, sales } from "./schema.js";

/**
 * Until v0.4.0 an empty "Amount paid now" box meant "paid in full", so a sale
 * the customer never paid for was saved as settled and never reached the khata.
 * These helpers find those sales and move them back onto the customer's khata.
 */
export type PaidInFullSaleDto = {
  saleId: number;
  invoiceNumber: string;
  customerId: number | null;
  customerName: string | null;
  saleDate: Date;
  totalAmountCents: number;
  amountPaidCents: number;
  paymentMethod: string | null;
  notes: string | null;
};

export type KhataRepairResultDto = {
  movedCount: number;
  movedAmountCents: number;
  skippedSaleIds: number[];
};

export class KhataRepairError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KhataRepairError";
  }
}

/**
 * Every sale still recorded as fully paid. A sale with no customer cannot carry
 * a balance, so it is reported with `customerId: null` and refused by the move.
 */
export function listSalesRecordedAsPaidInFull(databasePath?: string): PaidInFullSaleDto[] {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return db
      .select({
        saleId: sales.id,
        invoiceNumber: sales.invoiceNumber,
        customerId: sales.customerId,
        customerName: customers.name,
        saleDate: sales.saleDate,
        totalAmountCents: sales.totalAmountCents,
        amountPaidCents: sales.amountPaidCents,
        paymentMethod: sales.paymentMethod,
        notes: sales.notes,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(and(gt(sales.amountPaidCents, 0), eq(sales.amountPaidCents, sales.totalAmountCents)))
      .orderBy(desc(sales.saleDate), desc(sales.id))
      .all();
  } finally {
    sqlite.close();
  }
}

/**
 * Rewrites the named sales as nothing-paid and removes the payment that was
 * invented alongside them, so the whole amount shows up as owed on the khata.
 * Payments entered by hand in the Ledger screen carry no sale id and survive.
 */
export function moveSalesToKhata(databasePath: string | undefined, saleIds: number[], actorName?: string | null): KhataRepairResultDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const uniqueIds = [...new Set(saleIds)];

    if (uniqueIds.length === 0) {
      throw new KhataRepairError("Choose at least one sale to move onto the khata.");
    }

    if (uniqueIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new KhataRepairError("Sale IDs must be positive whole numbers.");
    }

    const result: KhataRepairResultDto = { movedCount: 0, movedAmountCents: 0, skippedSaleIds: [] };

    db.transaction((tx) => {
      const rows = tx.select().from(sales).where(inArray(sales.id, uniqueIds)).all();
      const found = new Set(rows.map((row) => row.id));
      const movable = rows.filter((row) => row.customerId !== null && row.amountPaidCents > 0);

      result.skippedSaleIds = [
        ...uniqueIds.filter((id) => !found.has(id)),
        ...rows.filter((row) => row.customerId === null || row.amountPaidCents === 0).map((row) => row.id),
      ].sort((left, right) => left - right);

      if (movable.length === 0) {
        return;
      }

      const movableIds = movable.map((row) => row.id);

      tx.delete(payments)
        .where(and(isNotNull(payments.saleId), inArray(payments.saleId, movableIds)))
        .run();

      tx.update(sales).set({ amountPaidCents: 0, updatedAt: new Date() }).where(inArray(sales.id, movableIds)).run();

      for (const row of movable) {
        tx.insert(auditLogs)
          .values({
            action: "sale.moved_to_khata",
            entityType: "sale",
            entityId: row.id,
            actorName: actorName?.trim() || null,
            details: JSON.stringify({
              invoiceNumber: row.invoiceNumber,
              reason: "Recorded as paid in full by the old blank-means-paid rule.",
              before: { amountPaidCents: row.amountPaidCents },
              after: { amountPaidCents: 0 },
            }),
          })
          .run();
      }

      result.movedCount = movable.length;
      result.movedAmountCents = movable.reduce((sum, row) => sum + row.amountPaidCents, 0);
    });

    return result;
  } finally {
    sqlite.close();
  }
}
