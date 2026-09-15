import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDb } from "./client";
import { getCustomerStatement, getInvoiceBySaleId, getInvoiceFolder, invoiceFileName, InvoiceValidationError, updateInvoiceFolder } from "./invoices-service";
import { createCustomer as createContactCustomer } from "./contacts-service";
import { recordPayment } from "./ledger-service";
import { runMigrations } from "./migrate";
import { createProduct, type ProductInput } from "./products-service";
import { createCustomer, createSale, type SaleInput } from "./sales-service";
import { settings } from "./schema";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stylecraft-invoices-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

function makeProductInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Oxford Shirt",
    sku: "OX-001",
    categoryName: "Shirts",
    purchasePriceCents: 1_250,
    sellingPriceCents: 2_499,
    currentStock: 5,
    lowStockThreshold: 2,
    isActive: true,
    ...overrides,
  };
}

function makeSaleInput(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    saleDate: new Date("2026-07-09T00:00:00.000Z"),
    paymentMethod: "Cash",
    notes: "Counter sale",
    items: [],
    ...overrides,
  };
}

function upsertSetting(databasePath: string, key: string, value: string) {
  const { sqlite, db } = createDb(databasePath);

  try {
    db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
      .run();
  } finally {
    sqlite.close();
  }
}

describe("invoice service", () => {
  it("returns a sale invoice with business settings, customer details, line items, and persisted totals", () => {
    const databasePath = makeTempDatabasePath();
    const product = createProduct(databasePath, makeProductInput());
    const customer = createCustomer(databasePath, {
      name: "Jane Buyer",
      phone: "555-0102",
      email: "jane@example.com",
      address: "12 Market Street",
    });

    upsertSetting(databasePath, "business.name", "StyleCraft Studio");
    upsertSetting(databasePath, "business.phone", "555-0100");
    upsertSetting(databasePath, "business.email", "hello@stylecraft.test");
    upsertSetting(databasePath, "business.address", "1 Main Street");
    upsertSetting(databasePath, "currency.symbol", "Rs. ");
    upsertSetting(databasePath, "invoice.prefix", "SC");

    const sale = createSale(
      databasePath,
      makeSaleInput({ customerId: customer.id, items: [{ variantId: product.variants[0].id, quantity: 2, unitPriceCents: 2_500, discountAmountCents: 500 }] }),
    );

    const invoice = getInvoiceBySaleId(databasePath, sale.id);

    expect(invoice).toMatchObject({
      saleId: sale.id,
      invoiceNumber: "INV-000001",
      customerName: "Jane Buyer",
      customerPhone: "555-0102",
      customerEmail: "jane@example.com",
      customerAddress: "12 Market Street",
      subtotalCents: 5_000,
      discountAmountCents: 500,
      totalAmountCents: 4_500,
      paymentMethod: "Cash",
      notes: "Counter sale",
      business: {
        businessName: "StyleCraft Studio",
        phone: "555-0100",
        email: "hello@stylecraft.test",
        address: "1 Main Street",
        currencySymbol: "Rs.",
        invoicePrefix: "SC",
      },
      items: [
        {
          productId: product.id,
          productName: "Oxford Shirt",
          productSku: "OX-001",
          quantity: 2,
          unitPriceCents: 2_500,
          discountAmountCents: 500,
          totalAmountCents: 4_500,
        },
      ],
    });
  });

  it("uses safe business defaults when settings are absent", () => {
    const databasePath = makeTempDatabasePath();
    const product = createProduct(databasePath, makeProductInput({ sku: "DEFAULTS" }));
    const sale = createSale(databasePath, makeSaleInput({ items: [{ variantId: product.variants[0].id, quantity: 1, unitPriceCents: 2_499 }] }));

    expect(getInvoiceBySaleId(databasePath, sale.id).business).toEqual({
      businessName: "StyleCraft",
      phone: "+92 326 0609031",
      email: "stylecraftpk.com@gmail.com",
      address: null,
      currencySymbol: "Rs.",
      invoicePrefix: "INV",
    });
  });

  it("rejects invalid or missing sale IDs", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => getInvoiceBySaleId(databasePath, 0)).toThrow(InvoiceValidationError);
    expect(() => getInvoiceBySaleId(databasePath, 999)).toThrow(InvoiceValidationError);
  });
});

describe("customer statement", () => {
  it("shows every invoice with its own line items, and the running balance beside them", () => {
    const databasePath = makeTempDatabasePath();
    const product = createProduct(databasePath, makeProductInput({ sku: "STMT-1" }));
    const customer = createCustomer(databasePath, { name: "Jane Buyer", phone: "555-0102" });

    const sale = createSale(
      databasePath,
      makeSaleInput({
        customerId: customer.id,
        amountPaidCents: 0,
        items: [{ variantId: product.variants[0].id, quantity: 3, unitPriceCents: 2_000, discountAmountCents: 500 }],
      }),
    );

    recordPayment(databasePath, { partyType: "customer", partyId: customer.id, amountCents: 1_500, paymentDate: new Date("2026-07-10T00:00:00.000Z") });

    const statement = getCustomerStatement(databasePath, customer.id);

    expect(statement).toMatchObject({
      customerId: customer.id,
      customerName: "Jane Buyer",
      customerPhone: "555-0102",
      invoicedCents: 5_500,
      paidCents: 1_500,
      balanceCents: 4_000,
    });

    const saleEntry = statement.entries.find((entry) => entry.kind === "sale");
    expect(saleEntry?.sale).toMatchObject({ saleId: sale.id, invoiceNumber: "INV-000001", totalAmountCents: 5_500 });
    expect(saleEntry?.sale?.items).toMatchObject([{ productName: "Oxford Shirt", quantity: 3, unitPriceCents: 2_000, totalAmountCents: 5_500 }]);
    expect(statement.entries.find((entry) => entry.kind === "payment")?.sale).toBeNull();
  });

  it("starts the statement with old udhaar carried over as an opening balance", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createContactCustomer(databasePath, { name: "Kamran", openingBalanceCents: 30_000 });

    const statement = getCustomerStatement(databasePath, customer.id);

    expect(statement.openingBalanceCents).toBe(30_000);
    expect(statement.balanceCents).toBe(30_000);
    expect(statement.entries[0]).toMatchObject({ kind: "opening", debitCents: 30_000, sale: null });
  });

  it("rejects invalid or missing customer IDs", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => getCustomerStatement(databasePath, 0)).toThrow(InvoiceValidationError);
    expect(() => getCustomerStatement(databasePath, 999)).toThrow(Error);
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
    expect(invoiceFileName(["INV-000001", "Jane Buyer"])).toBe("INV-000001 - Jane Buyer.pdf");
    expect(invoiceFileName(["Statement: Ali/Ahmed"])).toBe("Statement- Ali-Ahmed.pdf");
    expect(invoiceFileName([" ", null])).toBe("Invoice.pdf");
  });
});
