import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SaleJobInput } from "../src/types/stylecraft-api";
import { createCustomer } from "./contacts-service";
import { recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { getReports, ReportValidationError } from "./reports-service";
import { createSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-reports-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const none = { qty: 0, rateCents: 0 };

function job(jobName: string, overrides: Partial<SaleJobInput>): SaleJobInput {
  return { jobName, rota: none, gto: none, cutting: none, lamination: none, dye: none, ...overrides };
}

describe("reports service", () => {
  it("lists every job sold in the range with totals per kind of work", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, { name: "Ali" });
    const bilal = createCustomer(databasePath, { name: "Bilal" });

    createSale(databasePath, {
      customerId: ali.id,
      saleDate: "2026-11-01",
      jobs: [job("Cards", { rota: { qty: 100, rateCents: 100 } }), job("Bill books", { gto: { qty: 2, rateCents: 5_000 }, cutting: { qty: 1, rateCents: 500 } })],
    });
    createSale(databasePath, { customerId: bilal.id, saleDate: "2026-11-20", jobs: [job("Boxes", { dye: { qty: 3, rateCents: 1_000 }, lamination: { qty: 1, rateCents: 700 } })] });
    createSale(databasePath, { customerId: bilal.id, saleDate: "2026-12-01", jobs: [job("Outside", { dye: { qty: 1, rateCents: 99_999 } })] });
    recordPayment(databasePath, { customerId: ali.id, amountCents: 4_000, paymentDate: "2026-11-15" });
    recordPayment(databasePath, { customerId: ali.id, amountCents: 9_999, paymentDate: "2026-12-15" });

    const report = getReports(databasePath, { startDate: "2026-11-01", endDate: "2026-11-30" });

    expect(report.rows.map((row) => [row.billNumber, row.customerName, row.jobName, row.totalAmountCents])).toEqual([
      [1, "Ali", "Cards", 10_000],
      [1, "Ali", "Bill books", 10_500],
      [2, "Bilal", "Boxes", 3_700],
    ]);
    expect(report.workTotals).toEqual({ rota: 10_000, gto: 10_000, cutting: 500, lamination: 700, dye: 3_000 });
    expect(report.salesTotalCents).toBe(24_200);
    expect(report.billCount).toBe(2);
    expect(report.jobCount).toBe(3);
    expect(report.receivedCents).toBe(4_000);
  });

  it("narrows to one customer", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, { name: "Ali" });
    const bilal = createCustomer(databasePath, { name: "Bilal" });

    createSale(databasePath, { customerId: ali.id, saleDate: "2026-11-01", jobs: [job("Cards", { rota: { qty: 1, rateCents: 100 } })] });
    createSale(databasePath, { customerId: bilal.id, saleDate: "2026-11-01", jobs: [job("Boxes", { rota: { qty: 1, rateCents: 200 } })] });

    expect(getReports(databasePath, { customerId: bilal.id }).rows.map((row) => row.jobName)).toEqual(["Boxes"]);
  });

  it("refuses a backwards or malformed date range", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => getReports(databasePath, { startDate: "2026-11-02", endDate: "2026-11-01" })).toThrow(ReportValidationError);
    expect(() => getReports(databasePath, { startDate: "02/11/2026" })).toThrow(ReportValidationError);
  });
});
