import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDb } from "./client";
import { createCustomer } from "./contacts-service";
import { getBill, getInvoiceFolder, invoiceFileName, InvoiceValidationError, updateInvoiceFolder } from "./invoices-service";
import { runMigrations } from "./migrate";
import { createSale } from "./sales-service";
import { settings } from "./schema";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-invoices-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

const none = { qty: 0, rateCents: 0 };

describe("bill document", () => {
  it("returns a bill with business settings, customer details and every job", () => {
    const databasePath = makeTempDatabasePath();
    const { sqlite, db } = createDb(databasePath);
    db.insert(settings)
      .values([
        { key: "business.name", value: "Islamia Printers" },
        { key: "business.phone", value: "0300-0000000" },
        { key: "business.address", value: "Press Market, Faisalabad" },
        { key: "currency.symbol", value: "Rs." },
      ])
      .run();
    sqlite.close();

    const customer = createCustomer(databasePath, { name: "Al Noor", phone: "0321-1111111", address: "Jhang Bazar" });
    const sale = createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-11-10",
      notes: "Deliver Friday",
      jobs: [{ jobName: "Cards", rota: { qty: 1000, rateCents: 200 }, gto: none, cutting: { qty: 1, rateCents: 5_000 }, lamination: none, dye: none }],
    });

    const bill = getBill(databasePath, sale.id);

    expect(bill).toMatchObject({
      billNumber: 1,
      customerName: "Al Noor",
      customerPhone: "0321-1111111",
      customerAddress: "Jhang Bazar",
      totalAmountCents: 205_000,
      notes: "Deliver Friday",
      business: { businessName: "Islamia Printers", phone: "0300-0000000", address: "Press Market, Faisalabad", currencySymbol: "Rs." },
    });
    expect(bill.jobs[0]).toMatchObject({ jobName: "Cards", rota: { amountCents: 200_000 }, cutting: { amountCents: 5_000 } });
  });

  it("uses safe business defaults when settings are absent", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, { name: "Ali" });
    const sale = createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-11-10",
      jobs: [{ jobName: "Cards", rota: { qty: 1, rateCents: 100 }, gto: none, cutting: none, lamination: none, dye: none }],
    });

    expect(getBill(databasePath, sale.id).business).toEqual({ businessName: "Islamia Printers", phone: null, email: null, address: null, currencySymbol: "Rs." });
  });

  it("rejects invalid or missing bill IDs", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => getBill(databasePath, 0)).toThrow(InvoiceValidationError);
    expect(() => getBill(databasePath, 999)).toThrow("Bill was not found.");
  });
});

describe("invoice folder", () => {
  it("falls back to the folder the app suggests until one is saved", () => {
    const databasePath = makeTempDatabasePath();
    const suggested = path.join(path.dirname(databasePath), "Suggested Invoices");

    expect(getInvoiceFolder(databasePath, suggested)).toEqual({ folder: path.resolve(suggested), isDefaultFolder: true });
  });

  it("remembers a chosen folder and creates it", () => {
    const databasePath = makeTempDatabasePath();
    const chosen = path.join(path.dirname(databasePath), "Chosen Invoices");

    expect(updateInvoiceFolder(databasePath, chosen)).toEqual({ folder: path.resolve(chosen), isDefaultFolder: false });
    expect(fs.existsSync(chosen)).toBe(true);
    expect(getInvoiceFolder(databasePath, "ignored")).toEqual({ folder: path.resolve(chosen), isDefaultFolder: false });
  });

  it("refuses an empty folder", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => updateInvoiceFolder(databasePath, "   ")).toThrow(InvoiceValidationError);
  });
});

describe("invoice file names", () => {
  it("keeps a saved file name readable and safe on Windows", () => {
    expect(invoiceFileName(["Bill 1", "Jane Buyer"])).toBe("Bill 1 - Jane Buyer.pdf");
    expect(invoiceFileName(["Ledger: Ali/Ahmed"])).toBe("Ledger- Ali-Ahmed.pdf");
    expect(invoiceFileName([" ", null])).toBe("Invoice.pdf");
  });
});
