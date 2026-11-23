import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { LedgerBillEntryDto, LedgerPaymentEntryDto, SaleInput } from "../src/types/stylecraft-api";
import { createCustomer } from "./contacts-service";
import { getBill } from "./invoices-service";
import { deletePayment, getLedgerStatement, getLedgerSummary, listPayments, recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { getReports } from "./reports-service";
import { createSale, deleteSale, getSale, listSales, SaleValidationError, updateSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-cash-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const rupees = (amount: number) => amount * 100;
const none = { qty: 0, rateCents: 0 };

function cashSale(customerId: number, overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    kind: "cash",
    customerId,
    saleDate: "2026-11-23",
    items: [
      { description: "700g UV Round Corner Matt Card (500x2)", qty: 1000, rateCents: rupees(13) },
      { description: "Envelopes", qty: 200, rateCents: rupees(15) },
    ],
    advanceCents: rupees(8_000),
    advanceMethod: "online",
    advanceReference: "JazzCash TID 5521",
    ...overrides,
  };
}

function rowCount(databasePath: string, table: string) {
  const sqlite = new Database(databasePath);
  const row = sqlite.prepare(`select count(*) as count from ${table}`).get() as { count: number };
  sqlite.close();
  return row.count;
}

describe("cash sales", () => {
  it("records description / qty / rate lines, the advance and the balance", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "360 Estate (Soban Raj)" });

    const sale = createSale(databasePath, cashSale(customer.id));

    expect(sale).toMatchObject({
      kind: "cash",
      billNumber: 1,
      totalAmountCents: rupees(16_000),
      advanceCents: rupees(8_000),
      advanceMethod: "online",
      advanceReference: "JazzCash TID 5521",
      balanceCents: rupees(8_000),
      jobs: [],
    });
    expect(sale.items.map((item) => [item.description, item.qty, item.rateCents, item.amountCents])).toEqual([
      ["700g UV Round Corner Matt Card (500x2)", 1000, rupees(13), rupees(13_000)],
      ["Envelopes", 200, rupees(15), rupees(3_000)],
    ]);
  });

  it("puts the bill and its advance on the customer's khata", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Soban Raj", openingBalanceCents: rupees(1_000) });
    createSale(databasePath, cashSale(customer.id));

    const statement = getLedgerStatement(databasePath, customer.id);

    expect(statement.entries.map((entry) => entry.kind)).toEqual(["bill", "payment"]);
    const bill = statement.entries[0] as LedgerBillEntryDto;
    expect(bill.saleKind).toBe("cash");
    expect(bill.items.map((item) => [item.description, item.balanceCents])).toEqual([
      ["700g UV Round Corner Matt Card (500x2)", rupees(14_000)],
      ["Envelopes", rupees(17_000)],
    ]);
    expect(statement.entries[1]).toMatchObject({ method: "online", billNumber: 1, amountCents: rupees(8_000), balanceCents: rupees(9_000) } satisfies Partial<LedgerPaymentEntryDto>);
    expect(getLedgerSummary(databasePath).customers[0]).toMatchObject({ billedCents: rupees(16_000), receivedCents: rupees(8_000), balanceCents: rupees(9_000) });
  });

  it("records no payment when nothing was taken in advance", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    const sale = createSale(databasePath, cashSale(customer.id, { advanceCents: 0 }));

    expect(sale).toMatchObject({ advanceCents: 0, advanceMethod: null, balanceCents: rupees(16_000) });
    expect(rowCount(databasePath, "payments")).toBe(0);
  });

  it("lets a job bill take an advance too", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    const sale = createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-11-23",
      jobs: [{ jobName: "Cards", rota: { qty: 1000, rateCents: 200 }, gto: none, cutting: none, lamination: none, dye: none }],
      advanceCents: rupees(500),
    });

    expect(sale).toMatchObject({ kind: "job", totalAmountCents: rupees(2_000), advanceCents: rupees(500), advanceMethod: "cash", balanceCents: rupees(1_500) });
    expect(getBill(databasePath, sale.id)).toMatchObject({ advanceCents: rupees(500), balanceCents: rupees(1_500) });
  });

  it("keeps the advance's receipt number when the bill is edited, and drops it when the advance is cleared", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    const sale = createSale(databasePath, cashSale(customer.id));
    const [advance] = listPayments(databasePath);

    updateSale(databasePath, sale.id, cashSale(customer.id, { advanceCents: rupees(10_000), advanceMethod: "cash", advanceReference: null }));

    const [changed] = listPayments(databasePath);
    expect(changed).toMatchObject({ id: advance.id, receiptNumber: advance.receiptNumber, amountCents: rupees(10_000), method: "cash", narration: null, billNumber: 1 });

    updateSale(databasePath, sale.id, cashSale(customer.id, { advanceCents: 0 }));

    expect(listPayments(databasePath)).toEqual([]);
    expect(getSale(databasePath, sale.id).balanceCents).toBe(rupees(16_000));
  });

  it("removes the advance with the bill", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    const sale = createSale(databasePath, cashSale(customer.id));

    deleteSale(databasePath, sale.id);

    expect(rowCount(databasePath, "payments")).toBe(0);
    expect(rowCount(databasePath, "cash_sale_items")).toBe(0);
    expect(getLedgerSummary(databasePath).customers[0].balanceCents).toBe(0);
  });

  it("will not delete a bill's advance on its own", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    createSale(databasePath, cashSale(customer.id));
    const [advance] = listPayments(databasePath);

    expect(() => deletePayment(databasePath, advance.id)).toThrow("Edit the bill");
  });

  it("refuses bad lines, too large an advance and a change of bill type", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() => createSale(databasePath, cashSale(customer.id, { items: [] }))).toThrow("at least one line");
    expect(() => createSale(databasePath, cashSale(customer.id, { items: [{ description: " ", qty: 1, rateCents: 100 }] }))).toThrow("needs a description");
    expect(() => createSale(databasePath, cashSale(customer.id, { items: [{ description: "Card", qty: 0, rateCents: 100 }] }))).toThrow("quantity must be more than zero");
    expect(() => createSale(databasePath, cashSale(customer.id, { items: [{ description: "Card", qty: 1, rateCents: 0 }] }))).toThrow("rate must be more than zero");
    expect(() => createSale(databasePath, cashSale(customer.id, { advanceCents: rupees(16_001) }))).toThrow("Advance cannot be more than the bill total");
    expect(() => createSale(databasePath, cashSale(customer.id, { advanceCents: -1 }))).toThrow(SaleValidationError);

    const sale = createSale(databasePath, cashSale(customer.id));
    expect(() =>
      updateSale(databasePath, sale.id, { kind: "job", customerId: customer.id, saleDate: "2026-11-23", jobs: [{ jobName: "Cards", rota: { qty: 1, rateCents: 100 }, gto: none, cutting: none, lamination: none, dye: none }] }),
    ).toThrow("cash sale bill");
  });

  it("shares bill numbers with job bills and lists each kind on its own", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    createSale(databasePath, { customerId: customer.id, saleDate: "2026-11-22", jobs: [{ jobName: "Cards", rota: { qty: 1, rateCents: 100 }, gto: none, cutting: none, lamination: none, dye: none }] });
    createSale(databasePath, cashSale(customer.id));

    expect(listSales(databasePath, { kind: "cash" }).map((sale) => [sale.billNumber, sale.jobNames])).toEqual([[2, ["700g UV Round Corner Matt Card (500x2)", "Envelopes"]]]);
    expect(listSales(databasePath, { kind: "job" }).map((sale) => sale.billNumber)).toEqual([1]);
    expect(listSales(databasePath).map((sale) => sale.billNumber)).toEqual([2, 1]);
  });
});

describe("payments received", () => {
  it("records cash and online payments and lists them with filters", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, { name: "Ali" });
    const bilal = createCustomer(databasePath, { name: "Bilal" });

    const cash = recordPayment(databasePath, { customerId: ali.id, amountCents: rupees(500), paymentDate: "2026-11-20" });
    recordPayment(databasePath, { customerId: bilal.id, amountCents: rupees(700), paymentDate: "2026-11-21", method: "online", narration: "Easypaisa TID 9" });
    createSale(databasePath, cashSale(ali.id, { saleDate: "2026-11-22" }));

    expect(cash.method).toBe("cash");
    expect(listPayments(databasePath).map((payment) => [payment.receiptNumber, payment.customerName, payment.method, payment.billNumber])).toEqual([
      [3, "Ali", "online", 1],
      [2, "Bilal", "online", null],
      [1, "Ali", "cash", null],
    ]);
    expect(listPayments(databasePath, { method: "cash" }).map((payment) => payment.receiptNumber)).toEqual([1]);
    expect(listPayments(databasePath, { customerId: ali.id }).map((payment) => payment.receiptNumber)).toEqual([3, 1]);
    expect(listPayments(databasePath, { startDate: "2026-11-21", endDate: "2026-11-21" }).map((payment) => payment.receiptNumber)).toEqual([2]);
  });

  it("refuses a payment method other than cash or online", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    expect(() => recordPayment(databasePath, { customerId: customer.id, amountCents: 100, paymentDate: "2026-11-20", method: "cheque" as never })).toThrow("cash or online");
  });

  it("splits received money into cash and online in the report, and counts cash sales", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });

    createSale(databasePath, cashSale(customer.id));
    recordPayment(databasePath, { customerId: customer.id, amountCents: rupees(1_000), paymentDate: "2026-11-23" });

    const report = getReports(databasePath, { startDate: "2026-11-01", endDate: "2026-11-30" });

    expect(report.rows.map((row) => [row.saleKind, row.jobName, row.qty, row.rateCents, row.totalAmountCents])).toEqual([
      ["cash", "700g UV Round Corner Matt Card (500x2)", 1000, rupees(13), rupees(13_000)],
      ["cash", "Envelopes", 200, rupees(15), rupees(3_000)],
    ]);
    expect(report.cashSalesCents).toBe(rupees(16_000));
    expect(report.receivedCashCents).toBe(rupees(1_000));
    expect(report.receivedOnlineCents).toBe(rupees(8_000));
    expect(report.receivedCents).toBe(rupees(9_000));
  });
});
