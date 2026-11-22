import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SaleJobInput } from "../src/types/stylecraft-api";
import { createCustomer } from "./contacts-service";
import { getDashboardSummary } from "./dashboard-service";
import { recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { createSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-dashboard-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const none = { qty: 0, rateCents: 0 };

function job(overrides: Partial<SaleJobInput>): SaleJobInput {
  return { jobName: "Job", rota: none, gto: none, cutting: none, lamination: none, dye: none, ...overrides };
}

describe("dashboard service", () => {
  it("returns zeroes for an empty database", () => {
    const summary = getDashboardSummary(makeTempDatabasePath(), new Date(2026, 10, 22, 12));

    expect(summary).toEqual({
      todaySalesCents: 0,
      todayBillCount: 0,
      monthSalesCents: 0,
      monthBillCount: 0,
      monthReceivedCents: 0,
      totalReceivableCents: 0,
      customerCount: 0,
      monthWorkTotals: { rota: 0, gto: 0, cutting: 0, lamination: 0, dye: 0 },
      topReceivables: [],
    });
  });

  it("totals today, this month, the work done and who owes the most", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, { name: "Ali", openingBalanceCents: 10_000 });
    const bilal = createCustomer(databasePath, { name: "Bilal" });
    const advance = createCustomer(databasePath, { name: "Advance", openingBalanceCents: -5_000 });

    createSale(databasePath, { customerId: ali.id, saleDate: "2026-11-22", jobs: [job({ rota: { qty: 10, rateCents: 1_000 } })] });
    createSale(databasePath, { customerId: bilal.id, saleDate: "2026-11-05", jobs: [job({ gto: { qty: 1, rateCents: 50_000 }, dye: { qty: 2, rateCents: 1_000 } })] });
    createSale(databasePath, { customerId: bilal.id, saleDate: "2026-10-30", jobs: [job({ cutting: { qty: 1, rateCents: 99_999 } })] });
    recordPayment(databasePath, { customerId: bilal.id, amountCents: 30_000, paymentDate: "2026-11-10" });
    recordPayment(databasePath, { customerId: bilal.id, amountCents: 1_000, paymentDate: "2026-10-10" });

    const summary = getDashboardSummary(databasePath, new Date(2026, 10, 22, 15));

    expect(summary.todaySalesCents).toBe(10_000);
    expect(summary.todayBillCount).toBe(1);
    expect(summary.monthSalesCents).toBe(62_000);
    expect(summary.monthBillCount).toBe(2);
    expect(summary.monthReceivedCents).toBe(30_000);
    expect(summary.monthWorkTotals).toEqual({ rota: 10_000, gto: 50_000, cutting: 0, lamination: 0, dye: 2_000 });
    expect(summary.customerCount).toBe(3);
    expect(summary.topReceivables.map((row) => [row.customerName, row.balanceCents])).toEqual([
      ["Bilal", 52_000 + 99_999 - 31_000],
      ["Ali", 20_000],
    ]);
    expect(summary.totalReceivableCents).toBe(120_999 + 20_000);
    expect(advance.id).toBeGreaterThan(0);
  });
});
