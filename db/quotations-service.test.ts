import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { QuotationInput } from "../src/types/stylecraft-api";
import { createCustomer, listCustomers } from "./contacts-service";
import { getLedgerSummary, listPayments } from "./ledger-service";
import { runMigrations } from "./migrate";
import {
  convertQuotationToSale,
  createQuotation,
  deleteQuotation,
  getNextQuotationNumber,
  getQuotation,
  listQuotations,
  QuotationValidationError,
  updateQuotation,
} from "./quotations-service";
import { deleteSale, getNextBillNumber } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-quote-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const rupees = (amount: number) => amount * 100;

function quote(overrides: Partial<QuotationInput> = {}): QuotationInput {
  return {
    customerName: "Madina Pharma",
    customerPhone: "0300-5555555",
    quotationDate: "2026-11-23",
    validUntil: "2026-11-30",
    notes: "Rates for 1000 boxes",
    items: [
      { description: "Medicine box 3 colour", qty: 1000, rateCents: rupees(18) },
      { description: "Die cutting", qty: 1, rateCents: rupees(1_500) },
    ],
    ...overrides,
  };
}

describe("quotations", () => {
  it("records a quotation for a party typed in by name, numbered on its own, off the khata", () => {
    const databasePath = makeTempDatabasePath();

    expect(getNextQuotationNumber(databasePath)).toBe(1);
    const quotation = createQuotation(databasePath, quote());

    expect(quotation).toMatchObject({
      quotationNumber: 1,
      customerId: null,
      customerName: "Madina Pharma",
      customerPhone: "0300-5555555",
      totalAmountCents: rupees(19_500),
      notes: "Rates for 1000 boxes",
      convertedSaleId: null,
    });
    expect(quotation.validUntil?.getDate()).toBe(30);
    expect(quotation.items.map((item) => [item.description, item.amountCents])).toEqual([
      ["Medicine box 3 colour", rupees(18_000)],
      ["Die cutting", rupees(1_500)],
    ]);
    expect(listCustomers(databasePath)).toEqual([]);
    expect(getNextBillNumber(databasePath)).toBe(1);
  });

  it("takes the name and phone from a saved customer", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Al Noor Traders", phone: "0321-1111111" });

    const quotation = createQuotation(databasePath, quote({ customerId: customer.id, customerName: "ignored", customerPhone: null }));

    expect(quotation).toMatchObject({ customerId: customer.id, customerName: "Al Noor Traders", customerPhone: "0321-1111111" });
  });

  it("edits a quotation in place and deletes one", () => {
    const databasePath = makeTempDatabasePath();
    const quotation = createQuotation(databasePath, quote());

    const updated = updateQuotation(databasePath, quotation.id, quote({ items: [{ description: "Boxes", qty: 500, rateCents: rupees(20) }] }));
    expect(updated).toMatchObject({ quotationNumber: 1, totalAmountCents: rupees(10_000) });
    expect(updated.items).toHaveLength(1);

    deleteQuotation(databasePath, quotation.id);
    expect(listQuotations(databasePath)).toEqual([]);
    expect(() => getQuotation(databasePath, quotation.id)).toThrow("Quotation was not found.");
  });

  it("refuses a quotation with no party, no lines, a bad line or a validity before its date", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => createQuotation(databasePath, quote({ customerName: " " }))).toThrow("Choose a customer or type the party's name.");
    expect(() => createQuotation(databasePath, quote({ customerId: 99 }))).toThrow("Customer was not found.");
    expect(() => createQuotation(databasePath, quote({ items: [] }))).toThrow("at least one line");
    expect(() => createQuotation(databasePath, quote({ items: [{ description: "Box", qty: 0, rateCents: 100 }] }))).toThrow("quantity must be more than zero");
    expect(() => createQuotation(databasePath, quote({ validUntil: "2026-11-01" }))).toThrow(QuotationValidationError);
  });

  it("searches by number, party and item", () => {
    const databasePath = makeTempDatabasePath();
    createQuotation(databasePath, quote());
    createQuotation(databasePath, quote({ customerName: "Bilal", customerPhone: null, items: [{ description: "Wedding cards", qty: 100, rateCents: 5_000 }] }));

    expect(listQuotations(databasePath, { search: "wedding" }).map((row) => row.quotationNumber)).toEqual([2]);
    expect(listQuotations(databasePath, { search: "Q-1" }).map((row) => row.quotationNumber)).toEqual([1]);
    expect(listQuotations(databasePath, { search: "5555" }).map((row) => row.quotationNumber)).toEqual([1]);
  });

  it("turns an agreed quotation into a cash sale bill on the khata, adding a typed-in party to Customers", () => {
    const databasePath = makeTempDatabasePath();
    const quotation = createQuotation(databasePath, quote());

    const sale = convertQuotationToSale(databasePath, quotation.id, { saleDate: "2026-11-25", advanceCents: rupees(5_000), advanceMethod: "online", advanceReference: "Meezan" });

    expect(sale).toMatchObject({ kind: "cash", billNumber: 1, customerName: "Madina Pharma", totalAmountCents: rupees(19_500), advanceCents: rupees(5_000), advanceMethod: "online" });
    expect(sale.notes).toBe("Quotation Q-1: Rates for 1000 boxes");
    expect(sale.items.map((item) => item.description)).toEqual(["Medicine box 3 colour", "Die cutting"]);
    expect(listCustomers(databasePath).map((customer) => customer.name)).toEqual(["Madina Pharma"]);
    expect(getLedgerSummary(databasePath).customers[0].balanceCents).toBe(rupees(14_500));
    expect(listPayments(databasePath)[0]).toMatchObject({ amountCents: rupees(5_000), billNumber: 1 });
    expect(getQuotation(databasePath, quotation.id)).toMatchObject({ convertedSaleId: sale.id, convertedBillNumber: 1, customerId: sale.customerId });
  });

  it("will not make a second bill from the same quotation", () => {
    const databasePath = makeTempDatabasePath();
    const quotation = createQuotation(databasePath, quote());
    convertQuotationToSale(databasePath, quotation.id, { saleDate: "2026-11-25" });

    expect(() => convertQuotationToSale(databasePath, quotation.id, { saleDate: "2026-11-25" })).toThrow("already Bill No. 1");
  });

  it("makes nothing when the bill is refused, and frees the quotation when its bill is deleted", () => {
    const databasePath = makeTempDatabasePath();
    const quotation = createQuotation(databasePath, quote());

    expect(() => convertQuotationToSale(databasePath, quotation.id, { saleDate: "2026-11-25", advanceCents: rupees(99_999) })).toThrow("Advance cannot be more than the bill total");
    expect(listCustomers(databasePath)).toEqual([]);
    expect(getQuotation(databasePath, quotation.id).convertedSaleId).toBeNull();

    const sale = convertQuotationToSale(databasePath, quotation.id, { saleDate: "2026-11-25" });
    deleteSale(databasePath, sale.id);

    expect(getQuotation(databasePath, quotation.id)).toMatchObject({ convertedSaleId: null, convertedBillNumber: null });
  });
});
