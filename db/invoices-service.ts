import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

import type { BillDocumentDto, InvoiceFolderDto } from "../src/types/stylecraft-api.js";
import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";
import { getSale } from "./sales-service.js";
import { customers, settings } from "./schema.js";
import { getBusinessSettings } from "./settings-service.js";

const invoiceFolderKey = "invoice.folder";

export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceValidationError";
  }
}

/** One bill as the customer should see it: the shop, the customer, every job and its charges. */
export function getBill(databasePath: string | undefined, saleId: number): BillDocumentDto {
  if (!Number.isInteger(saleId) || saleId <= 0) {
    throw new InvoiceValidationError("Bill must be selected.");
  }

  const sale = getSale(databasePath, saleId);
  const { businessName, phone, email, address, currencySymbol } = getBusinessSettings(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const customer = db.select({ address: customers.address }).from(customers).where(eq(customers.id, sale.customerId)).get();

    return {
      ...sale,
      customerAddress: customer?.address ?? null,
      business: { businessName, phone, email, address, currencySymbol },
    };
  } finally {
    sqlite.close();
  }
}

/** Where saved invoice PDFs go. The caller supplies the default, because only the app knows the user's Documents folder. */
export function getInvoiceFolder(databasePath: string | undefined, defaultFolder: string): InvoiceFolderDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const savedFolder = db.select({ value: settings.value }).from(settings).where(eq(settings.key, invoiceFolderKey)).get()?.value.trim() || null;

    return {
      folder: path.resolve(savedFolder ?? defaultFolder),
      isDefaultFolder: savedFolder === null,
    };
  } finally {
    sqlite.close();
  }
}

export function updateInvoiceFolder(databasePath: string | undefined, folder: string): InvoiceFolderDto {
  const trimmedFolder = folder.trim();

  if (!trimmedFolder) {
    throw new InvoiceValidationError("Invoice folder is required.");
  }

  const normalizedFolder = path.resolve(trimmedFolder);
  runMigrations(databasePath);
  fs.mkdirSync(normalizedFolder, { recursive: true });
  const { sqlite, db } = createDb(databasePath);
  const now = new Date();

  try {
    db.insert(settings)
      .values({ key: invoiceFolderKey, value: normalizedFolder, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: normalizedFolder, updatedAt: now } })
      .run();

    return { folder: normalizedFolder, isDefaultFolder: false };
  } finally {
    sqlite.close();
  }
}

/** Keeps a saved file name safe on Windows and readable in a chat. */
export function invoiceFileName(parts: Array<string | null | undefined>) {
  const name = parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "")
    .join(" - ")
    .replace(/[\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return `${name || "Invoice"}.pdf`;
}
