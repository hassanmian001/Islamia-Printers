import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { LedgerBillEntryDto, LedgerPaymentEntryDto, SaleJobInput } from "../src/types/stylecraft-api";
import { createCustomer } from "./contacts-service";
import { deletePayment, getLedgerStatement, getLedgerSummary, getNextReceiptNumber, LedgerValidationError, recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { createSale, deleteSale, updateSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-ledger-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const none = { qty: 0, rateCents: 0 };

function job(jobName: string, overrides: Partial<SaleJobInput> = {}): SaleJobInput {
  return { jobName, rota: none, gto: none, cutting: none, lamination: none, dye: none, ...overrides };
}

function rupees(amount: number) {
  return amount * 100;
}

describe("ledger service", () => {
  it("adds every bill and takes off every payment, starting from the opening balance", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Islamia Press", phone: "0300-6609031", openingBalanceCents: rupees(209_091) });

    createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-10-01",
      jobs: [job("Offset 27x34", { rota: { qty: 385, rateCents: rupees(18) }, cutting: { qty: 1, rateCents: rupees(50) } })],
    });
    recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(5_000), paymentDate: "2026-10-10", narration: "mzn" });

    const summary = getLedgerSummary(databasePath);

    expect(summary.customers).toEqual([
      expect.objectContaining({
        customerName: "Islamia Press",
        openingBalanceCents: rupees(209_091),
        billedCents: rupees(6_980),
        receivedCents: rupees(5_000),
        balanceCents: rupees(209_091 + 6_980 - 5_000),
      }),
    ]);
    expect(summary.totalReceivableCents).toBe(rupees(211_071));
    expect(summary.customers[0].lastActivityDate?.getDate()).toBe(10);
  });

  it("lists a bill job by job with a running balance and a sub-total, then payments", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali", openingBalanceCents: rupees(1_000) });

    createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-11-01",
      jobs: [
        job("Visiting cards", { rota: { qty: 1000, rateCents: rupees(2) }, cutting: { qty: 1, rateCents: rupees(100) } }),
        job("Letterhead", { gto: { qty: 500, rateCents: rupees(3) }, lamination: { qty: 2, rateCents: rupees(250) } }),
      ],
    });
    const payment = recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(2_000), paymentDate: "2026-11-03", narration: "cash" });

    const statement = getLedgerStatement(databasePath, customer.id);

    expect(statement.openingBalanceCents).toBe(rupees(1_000));
    expect(statement.entries.map((entry) => entry.kind)).toEqual(["bill", "payment"]);

    const bill = statement.entries[0] as LedgerBillEntryDto;
    expect(bill.billNumber).toBe(1);
    expect(bill.jobs.map((row) => [row.jobName, row.totalAmountCents, row.balanceCents])).toEqual([
      ["Visiting cards", rupees(2_100), rupees(3_100)],
      ["Letterhead", rupees(2_000), rupees(5_100)],
    ]);
    expect(bill.workTotals).toEqual({ rota: rupees(2_000), gto: rupees(1_500), cutting: rupees(100), lamination: rupees(500), dye: 0 });
    expect(bill.totalAmountCents).toBe(rupees(4_100));
    expect(bill.balanceCents).toBe(rupees(5_100));

    const paid = statement.entries[1] as LedgerPaymentEntryDto;
    expect(paid).toMatchObject({ receiptNumber: payment.receiptNumber, narration: "cash", amountCents: rupees(2_000), balanceCents: rupees(3_100) });

    expect(statement.debitCents).toBe(rupees(4_100));
    expect(statement.creditCents).toBe(rupees(2_000));
    expect(statement.closingBalanceCents).toBe(rupees(3_100));
    expect(statement.workTotals.rota).toBe(rupees(2_000));
    expect(statement.business.businessName).toBe("Islamia Printers");
  });

  it("carries everything before the from date into the opening balance", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali", openingBalanceCents: rupees(500) });

    createSale(databasePath, { customerId: customer.id, saleDate: "2026-09-20", jobs: [job("Old job", { dye: { qty: 1, rateCents: rupees(1_000) } })] });
    recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(300), paymentDate: "2026-09-25" });
    createSale(databasePath, { customerId: customer.id, saleDate: "2026-10-05", jobs: [job("October job", { dye: { qty: 1, rateCents: rupees(700) } })] });
    createSale(databasePath, { customerId: customer.id, saleDate: "2026-12-01", jobs: [job("Later job", { dye: { qty: 1, rateCents: rupees(9_999) } })] });

    const statement = getLedgerStatement(databasePath, customer.id, { startDate: "2026-10-01", endDate: "2026-11-30" });

    expect(statement.openingBalanceCents).toBe(rupees(500 + 1_000 - 300));
    expect(statement.entries).toHaveLength(1);
    expect((statement.entries[0] as LedgerBillEntryDto).jobs[0].jobName).toBe("October job");
    expect(statement.closingBalanceCents).toBe(rupees(1_200 + 700));
    expect(statement.startDate).toBe("2026-10-01");
    expect(statement.endDate).toBe("2026-11-30");
  });

  it("includes the whole of the to date", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    createSale(databasePath, { customerId: customer.id, saleDate: new Date(2026, 10, 16, 18, 30), jobs: [job("Evening job", { dye: { qty: 1, rateCents: 100 } })] });

    expect(getLedgerStatement(databasePath, customer.id, { endDate: "2026-11-16" }).entries).toHaveLength(1);
    expect(getLedgerStatement(databasePath, customer.id, { endDate: "2026-11-15" }).entries).toHaveLength(0);
  });

  it("keeps same-day entries in the order they were made", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(100), paymentDate: "2026-10-10" });
    createSale(databasePath, { customerId: customer.id, saleDate: "2026-10-10", jobs: [job("Job", { dye: { qty: 1, rateCents: rupees(400) } })] });

    const statement = getLedgerStatement(databasePath, customer.id);

    expect(statement.entries.map((entry) => [entry.kind, entry.balanceCents])).toEqual([
      ["payment", rupees(-100)],
      ["bill", rupees(300)],
    ]);
  });

  it("follows edits and deletions of bills", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    const sale = createSale(databasePath, { customerId: customer.id, saleDate: "2026-10-10", jobs: [job("Job", { dye: { qty: 1, rateCents: rupees(400) } })] });

    updateSale(databasePath, sale.id, { customerId: customer.id, saleDate: "2026-10-10", jobs: [job("Job", { dye: { qty: 2, rateCents: rupees(400) } })] });
    expect(getLedgerStatement(databasePath, customer.id).closingBalanceCents).toBe(rupees(800));

    deleteSale(databasePath, sale.id);
    expect(getLedgerStatement(databasePath, customer.id).closingBalanceCents).toBe(0);
  });

  it("numbers receipts on their own and lets a mistaken payment be removed", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(getNextReceiptNumber(databasePath)).toBe(1);
    const first = recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(50), paymentDate: "2026-10-10" });
    const second = recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(70), paymentDate: "2026-10-11", narration: "  " });

    expect([first.receiptNumber, second.receiptNumber]).toEqual([1, 2]);
    expect(second.narration).toBeNull();

    deletePayment(databasePath, first.id, "Owner");

    expect(getLedgerSummary(databasePath).customers[0].receivedCents).toBe(rupees(70));
    expect(() => deletePayment(databasePath, first.id)).toThrow("Payment was not found.");
  });

  it("refuses payments without a customer, an amount or a date", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() => recordPayment(databasePath, { customerId: 0, amountCents: 100, paymentDate: "2026-10-10" })).toThrow(LedgerValidationError);
    expect(() => recordPayment(databasePath, { customerId: 999, amountCents: 100, paymentDate: "2026-10-10" })).toThrow("Customer was not found.");
    expect(() => recordPayment(databasePath, { customerId: customer.id, amountCents: 0, paymentDate: "2026-10-10" })).toThrow("more than zero");
    expect(() => recordPayment(databasePath, { customerId: customer.id, amountCents: 100, paymentDate: "not a date" })).toThrow("Payment date is required.");
  });

  it("refuses a statement for an unknown customer or a backwards date range", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() => getLedgerStatement(databasePath, 999)).toThrow("Customer was not found.");
    expect(() => getLedgerStatement(databasePath, customer.id, { startDate: "2026-11-02", endDate: "2026-11-01" })).toThrow("from date");
  });
});
