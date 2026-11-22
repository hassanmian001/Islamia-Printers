import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SaleInput, SaleJobInput } from "../src/types/stylecraft-api";
import { createCustomer } from "./contacts-service";
import { runMigrations } from "./migrate";
import { createSale, deleteSale, getNextBillNumber, getSale, listSales, SaleValidationError, updateSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-sales-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const none = { qty: 0, rateCents: 0 };

function job(overrides: Partial<SaleJobInput> = {}): SaleJobInput {
  return { jobName: "Visiting cards", rota: none, gto: none, cutting: none, lamination: none, dye: none, ...overrides };
}

function saleInput(customerId: number, overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    customerId,
    saleDate: "2026-11-10",
    jobs: [
      job({
        jobName: "Visiting cards",
        rota: { qty: 2000, rateCents: 150 }, // 2000 x Rs 1.50 = Rs 3,000
        cutting: { qty: 1, rateCents: 50_000 }, // Rs 500
      }),
      job({
        jobName: "Letterhead",
        gto: { qty: 2.5, rateCents: 120_000 }, // 2.5 x Rs 1,200 = Rs 3,000
        lamination: { qty: 500, rateCents: 200 }, // Rs 1,000
        dye: { qty: 1, rateCents: 25_000 }, // Rs 250
      }),
    ],
    ...overrides,
  };
}

describe("sales service", () => {
  it("records a bill with each kind of work charged as quantity x rate", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Al Noor Traders" });

    const sale = createSale(databasePath, saleInput(customer.id));

    expect(sale.billNumber).toBe(1);
    expect(sale.customerName).toBe("Al Noor Traders");
    expect(sale.jobs.map((entry) => entry.jobName)).toEqual(["Visiting cards", "Letterhead"]);
    expect(sale.jobs[0]).toMatchObject({
      rota: { qty: 2000, rateCents: 150, amountCents: 300_000 },
      gto: { qty: 0, rateCents: 0, amountCents: 0 },
      cutting: { qty: 1, rateCents: 50_000, amountCents: 50_000 },
      totalAmountCents: 350_000,
    });
    expect(sale.jobs[1]).toMatchObject({
      gto: { qty: 2.5, rateCents: 120_000, amountCents: 300_000 },
      lamination: { amountCents: 100_000 },
      dye: { amountCents: 25_000 },
      totalAmountCents: 425_000,
    });
    expect(sale.totalAmountCents).toBe(775_000);
    expect(sale.saleDate.getHours()).toBe(0);
    expect(sale.saleDate.getDate()).toBe(10);
  });

  it("numbers bills one after another", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(getNextBillNumber(databasePath)).toBe(1);
    createSale(databasePath, saleInput(customer.id));
    createSale(databasePath, saleInput(customer.id));

    expect(getNextBillNumber(databasePath)).toBe(3);
    expect(listSales(databasePath).map((sale) => sale.billNumber)).toEqual([2, 1]);
  });

  it("rounds a fractional amount to the nearest paisa", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    const sale = createSale(databasePath, saleInput(customer.id, { jobs: [job({ rota: { qty: 3, rateCents: 33 } , cutting: { qty: 0.333, rateCents: 100 } })] }));

    expect(sale.jobs[0].rota.amountCents).toBe(99);
    expect(sale.jobs[0].cutting.amountCents).toBe(33);
    expect(sale.totalAmountCents).toBe(132);
  });

  it("refuses a bill with no customer, no jobs, a nameless job or a job with nothing charged", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() => createSale(databasePath, saleInput(0))).toThrow(SaleValidationError);
    expect(() => createSale(databasePath, saleInput(9999))).toThrow("Customer was not found.");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [] }))).toThrow("Add at least one job");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [job({ jobName: "  ", rota: { qty: 1, rateCents: 100 } })] }))).toThrow("needs a job name");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [job()] }))).toThrow("has no charges");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [job({ rota: { qty: 0, rateCents: 100 } })] }))).toThrow("has a rate but no quantity");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [job({ rota: { qty: -1, rateCents: 100 } })] }))).toThrow("cannot be negative");
    expect(() => createSale(databasePath, saleInput(customer.id, { jobs: [job({ rota: { qty: 1, rateCents: 1.5 } })] }))).toThrow("rate must be");
    expect(listSales(databasePath)).toEqual([]);
  });

  it("saves nothing when one job of the bill is rejected", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() =>
      createSale(databasePath, saleInput(customer.id, { jobs: [job({ rota: { qty: 1, rateCents: 100 } }), job({ jobName: "" })] })),
    ).toThrow(SaleValidationError);

    const sqlite = new Database(databasePath);
    expect(sqlite.prepare("select count(*) as count from sales").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("select count(*) as count from sale_jobs").get()).toEqual({ count: 0 });
    sqlite.close();
  });

  it("edits a bill in place, keeping its number and leaving a trail", () => {
    const databasePath = makeTempDatabasePath();
    const first = createCustomer(databasePath, { name: "Ali" });
    const second = createCustomer(databasePath, { name: "Bilal" });
    const sale = createSale(databasePath, saleInput(first.id));

    const updated = updateSale(
      databasePath,
      sale.id,
      saleInput(second.id, { saleDate: "2026-11-12", notes: "Rate corrected", jobs: [job({ jobName: "Flyers", rota: { qty: 1000, rateCents: 200 } })] }),
      "Owner",
    );

    expect(updated).toMatchObject({ id: sale.id, billNumber: 1, customerId: second.id, totalAmountCents: 200_000, notes: "Rate corrected" });
    expect(updated.jobs.map((entry) => entry.jobName)).toEqual(["Flyers"]);

    const sqlite = new Database(databasePath);
    expect(sqlite.prepare("select count(*) as count from sale_jobs").get()).toEqual({ count: 1 });
    expect(sqlite.prepare("select action, actor_name as actorName from audit_logs").all()).toEqual([{ action: "sale.updated", actorName: "Owner" }]);
    sqlite.close();
  });

  it("deletes a bill together with its jobs", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    const sale = createSale(databasePath, saleInput(customer.id));

    deleteSale(databasePath, sale.id, "Owner");

    expect(listSales(databasePath)).toEqual([]);
    expect(() => getSale(databasePath, sale.id)).toThrow("Bill was not found.");

    const sqlite = new Database(databasePath);
    expect(sqlite.prepare("select count(*) as count from sale_jobs").get()).toEqual({ count: 0 });
    expect(sqlite.prepare("select action from audit_logs").all()).toEqual([{ action: "sale.deleted" }]);
    sqlite.close();
  });

  it("filters bill history by customer, date range and search text", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, { name: "Ali" });
    const bilal = createCustomer(databasePath, { name: "Bilal" });

    createSale(databasePath, saleInput(ali.id, { saleDate: "2026-11-01" }));
    createSale(databasePath, saleInput(bilal.id, { saleDate: "2026-11-15", jobs: [job({ jobName: "Wedding cards", dye: { qty: 1, rateCents: 1000 } })] }));
    createSale(databasePath, saleInput(ali.id, { saleDate: "2026-11-30" }));

    expect(listSales(databasePath, { customerId: ali.id }).map((sale) => sale.billNumber)).toEqual([3, 1]);
    expect(listSales(databasePath, { startDate: "2026-11-15", endDate: "2026-11-30" }).map((sale) => sale.billNumber)).toEqual([3, 2]);
    expect(listSales(databasePath, { endDate: "2026-11-01" }).map((sale) => sale.billNumber)).toEqual([1]);
    expect(listSales(databasePath, { search: "wedding" }).map((sale) => sale.billNumber)).toEqual([2]);
    expect(listSales(databasePath, { search: "bilal" })[0]).toMatchObject({ jobCount: 1, jobNames: ["Wedding cards"] });
  });
});
