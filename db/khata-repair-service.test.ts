import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { listAuditLogs } from "./audit-service";
import { KhataRepairError, listSalesRecordedAsPaidInFull, moveSalesToKhata } from "./khata-repair-service";
import { getLedgerStatement, getLedgerSummary, recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { createProduct } from "./products-service";
import { createCustomer, createSale, listSales } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stylecraft-khata-repair-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

function makeProduct(databasePath: string) {
  return createProduct(databasePath, {
    name: "Hoodie",
    sku: "HOOD",
    purchasePriceCents: 1_000,
    sellingPriceCents: 2_000,
    currentStock: 50,
    lowStockThreshold: 1,
    isActive: true,
  });
}

describe("khata repair service", () => {
  it("lists only the sales still recorded as fully paid", () => {
    const databasePath = makeTempDatabasePath();
    const product = makeProduct(databasePath);
    const customer = createCustomer(databasePath, { name: "Ali" });
    const variantId = product.variants[0].id;

    const paidInFull = createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-01T00:00:00.000Z"),
      amountPaidCents: 4_000,
      items: [{ variantId, quantity: 2, unitPriceCents: 2_000 }],
    });

    createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-02T00:00:00.000Z"),
      amountPaidCents: 1_000,
      items: [{ variantId, quantity: 2, unitPriceCents: 2_000 }],
    });

    createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-03T00:00:00.000Z"),
      amountPaidCents: 0,
      items: [{ variantId, quantity: 1, unitPriceCents: 2_000 }],
    });

    const rows = listSalesRecordedAsPaidInFull(databasePath);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ saleId: paidInFull.id, customerName: "Ali", totalAmountCents: 4_000, amountPaidCents: 4_000 });
  });

  it("moves a wrongly settled sale onto the customer's khata", () => {
    const databasePath = makeTempDatabasePath();
    const product = makeProduct(databasePath);
    const customer = createCustomer(databasePath, { name: "Ali" });

    const sale = createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-01T00:00:00.000Z"),
      amountPaidCents: 4_000,
      items: [{ variantId: product.variants[0].id, quantity: 2, unitPriceCents: 2_000 }],
    });

    expect(getLedgerSummary(databasePath).customerReceivableCents).toBe(0);

    const result = moveSalesToKhata(databasePath, [sale.id], "Owner");

    expect(result).toMatchObject({ movedCount: 1, movedAmountCents: 4_000, skippedSaleIds: [] });
    expect(listSales(databasePath)[0]).toMatchObject({ amountPaidCents: 0, balanceDueCents: 4_000 });

    const summary = getLedgerSummary(databasePath);
    expect(summary.customers[0]).toMatchObject({ partyName: "Ali", invoicedCents: 4_000, paidCents: 0, balanceCents: 4_000 });
    expect(summary.customerReceivableCents).toBe(4_000);

    const statement = getLedgerStatement(databasePath, "customer", customer.id);
    expect(statement.entries.filter((entry) => entry.kind === "payment")).toHaveLength(0);

    const audit = listAuditLogs(databasePath, { action: "sale.moved_to_khata" });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entityId: sale.id, actorName: "Owner" });
  });

  it("keeps payments that were entered by hand in the ledger", () => {
    const databasePath = makeTempDatabasePath();
    const product = makeProduct(databasePath);
    const customer = createCustomer(databasePath, { name: "Ali" });

    const sale = createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-01T00:00:00.000Z"),
      amountPaidCents: 4_000,
      items: [{ variantId: product.variants[0].id, quantity: 2, unitPriceCents: 2_000 }],
    });

    recordPayment(databasePath, {
      partyType: "customer",
      partyId: customer.id,
      amountCents: 1_500,
      paymentDate: new Date("2026-08-05T00:00:00.000Z"),
      method: "Cash",
      notes: "Part payment",
    });

    moveSalesToKhata(databasePath, [sale.id]);

    const summary = getLedgerSummary(databasePath);
    expect(summary.customers[0]).toMatchObject({ invoicedCents: 4_000, paidCents: 1_500, balanceCents: 2_500 });
  });

  it("skips sales with no customer, sales already unpaid, and ids that do not exist", () => {
    const databasePath = makeTempDatabasePath();
    const product = makeProduct(databasePath);
    const variantId = product.variants[0].id;

    const walkIn = createSale(databasePath, {
      saleDate: new Date("2026-08-01T00:00:00.000Z"),
      amountPaidCents: 2_000,
      items: [{ variantId, quantity: 1, unitPriceCents: 2_000 }],
    });

    const customer = createCustomer(databasePath, { name: "Ali" });
    const unpaid = createSale(databasePath, {
      customerId: customer.id,
      saleDate: new Date("2026-08-02T00:00:00.000Z"),
      amountPaidCents: 0,
      items: [{ variantId, quantity: 1, unitPriceCents: 2_000 }],
    });

    const result = moveSalesToKhata(databasePath, [walkIn.id, unpaid.id, 9_999]);

    expect(result).toMatchObject({ movedCount: 0, movedAmountCents: 0 });
    expect(result.skippedSaleIds).toEqual([walkIn.id, unpaid.id, 9_999].sort((left, right) => left - right));
    expect(listSales(databasePath).find((row) => row.id === walkIn.id)?.amountPaidCents).toBe(2_000);
  });

  it("refuses an empty selection", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => moveSalesToKhata(databasePath, [])).toThrow(KhataRepairError);
  });
});
