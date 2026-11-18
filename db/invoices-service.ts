import { eq, inArray } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

import { createDb } from "./client.js";
import { getLedgerStatement, type LedgerEntryDto } from "./ledger-service.js";
import { runMigrations } from "./migrate.js";
import { formatVariantLabel } from "./products-service.js";
import { customers, productVariants, products, saleItems, sales, settings } from "./schema.js";

const defaultBusinessPhone: string | null = null;
const defaultBusinessEmail: string | null = null;
const invoiceFolderKey = "invoice.folder";

export type InvoiceBusinessSettingsDto = {
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currencySymbol: string;
  invoicePrefix: string;
};

export type InvoiceLineItemDto = {
  id: number;
  productId: number;
  variantLabel: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPriceCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
};

export type InvoiceDetailDto = {
  saleId: number;
  invoiceNumber: string;
  saleDate: Date;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  subtotalCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  paymentMethod: string | null;
  notes: string | null;
  business: InvoiceBusinessSettingsDto;
  items: InvoiceLineItemDto[];
};

export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceValidationError";
  }
}

function validateSaleId(saleId: number) {
  if (!Number.isInteger(saleId) || saleId <= 0) {
    throw new InvoiceValidationError("Sale ID must be a positive whole number.");
  }
}

function trimmedOrNull(value: string | null | undefined) {
  return value?.trim() || null;
}

function getBusinessSettings(rows: Array<typeof settings.$inferSelect>): InvoiceBusinessSettingsDto {
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    businessName: trimmedOrNull(values.get("business.name")) ?? "Islamia Printers",
    phone: trimmedOrNull(values.get("business.phone")) ?? defaultBusinessPhone,
    email: trimmedOrNull(values.get("business.email")) ?? defaultBusinessEmail,
    address: trimmedOrNull(values.get("business.address")),
    currencySymbol: trimmedOrNull(values.get("currency.symbol")) ?? "Rs.",
    invoicePrefix: trimmedOrNull(values.get("invoice.prefix")) ?? "INV",
  };
}

export function getInvoiceBySaleId(databasePath: string | undefined, saleId: number): InvoiceDetailDto {
  validateSaleId(saleId);
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const sale = db
      .select({
        saleId: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleDate: sales.saleDate,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerEmail: customers.email,
        customerAddress: customers.address,
        subtotalCents: sales.subtotalCents,
        discountAmountCents: sales.discountAmountCents,
        totalAmountCents: sales.totalAmountCents,
        paymentMethod: sales.paymentMethod,
        notes: sales.notes,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, saleId))
      .get();

    if (sale === undefined) {
      throw new InvoiceValidationError("Sale was not found.");
    }

    const itemRows = db
      .select({
        id: saleItems.id,
        productId: saleItems.productId,
        productName: products.name,
        productSku: products.sku,
        variantSize: productVariants.size,
        variantColor: productVariants.color,
        quantity: saleItems.quantity,
        unitPriceCents: saleItems.unitPriceCents,
        discountAmountCents: saleItems.discountAmountCents,
        totalAmountCents: saleItems.totalAmountCents,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .leftJoin(productVariants, eq(saleItems.variantId, productVariants.id))
      .where(eq(saleItems.saleId, saleId))
      .all();

    const items = itemRows.map(({ variantSize, variantColor, ...item }) => ({
      ...item,
      variantLabel: formatVariantLabel(variantSize || null, variantColor || null),
    }));

    return {
      ...sale,
      business: getBusinessSettings(db.select().from(settings).all()),
      items,
    };
  } finally {
    sqlite.close();
  }
}

/** One sale on a statement, with the lines that made it up. */
export type StatementSaleDto = {
  saleId: number;
  invoiceNumber: string;
  saleDate: Date;
  subtotalCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  paymentMethod: string | null;
  notes: string | null;
  items: InvoiceLineItemDto[];
};

/** A khata line, carrying the sale behind it when there is one. */
export type StatementEntryDto = LedgerEntryDto & {
  sale: StatementSaleDto | null;
};

export type CustomerStatementDto = {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  generatedAt: Date;
  openingBalanceCents: number;
  invoicedCents: number;
  paidCents: number;
  returnedCents: number;
  balanceCents: number;
  business: InvoiceBusinessSettingsDto;
  entries: StatementEntryDto[];
};

export type InvoiceFolderDto = {
  folder: string;
  isDefaultFolder: boolean;
};

function validateCustomerId(customerId: number) {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new InvoiceValidationError("Customer ID must be a positive whole number.");
  }
}

/**
 * A statement is the khata the ledger already builds, with every sale's lines
 * filled in underneath it, so the customer can see what each amount was for.
 */
export function getCustomerStatement(databasePath: string | undefined, customerId: number): CustomerStatementDto {
  validateCustomerId(customerId);
  const ledger = getLedgerStatement(databasePath, "customer", customerId);
  const { sqlite, db } = createDb(databasePath);

  try {
    const customer = db
      .select({ name: customers.name, phone: customers.phone, email: customers.email, address: customers.address })
      .from(customers)
      .where(eq(customers.id, customerId))
      .get();

    if (customer === undefined) {
      throw new InvoiceValidationError("Customer was not found.");
    }

    const saleIds = [...new Set(ledger.entries.filter((entry) => entry.kind === "sale" && entry.saleId !== null).map((entry) => entry.saleId as number))];
    const saleRows = saleIds.length === 0 ? [] : db.select().from(sales).where(inArray(sales.id, saleIds)).all();
    const itemsBySaleId = groupItemsBySaleId(db, saleIds);

    const salesById = new Map(
      saleRows.map((sale) => [
        sale.id,
        {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleDate: sale.saleDate,
          subtotalCents: sale.subtotalCents,
          discountAmountCents: sale.discountAmountCents,
          totalAmountCents: sale.totalAmountCents,
          paymentMethod: sale.paymentMethod,
          notes: sale.notes,
          items: itemsBySaleId.get(sale.id) ?? [],
        } satisfies StatementSaleDto,
      ]),
    );

    return {
      customerId,
      customerName: ledger.partyName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      generatedAt: new Date(),
      openingBalanceCents: ledger.openingBalanceCents,
      invoicedCents: ledger.invoicedCents,
      paidCents: ledger.paidCents,
      returnedCents: ledger.returnedCents,
      balanceCents: ledger.balanceCents,
      business: getBusinessSettings(db.select().from(settings).all()),
      entries: ledger.entries.map((entry) => ({
        ...entry,
        sale: entry.kind === "sale" && entry.saleId !== null ? (salesById.get(entry.saleId) ?? null) : null,
      })),
    };
  } finally {
    sqlite.close();
  }
}

function groupItemsBySaleId(db: ReturnType<typeof createDb>["db"], saleIds: number[]) {
  const grouped = new Map<number, InvoiceLineItemDto[]>();

  if (saleIds.length === 0) {
    return grouped;
  }

  const rows = db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      productId: saleItems.productId,
      productName: products.name,
      productSku: products.sku,
      variantSize: productVariants.size,
      variantColor: productVariants.color,
      quantity: saleItems.quantity,
      unitPriceCents: saleItems.unitPriceCents,
      discountAmountCents: saleItems.discountAmountCents,
      totalAmountCents: saleItems.totalAmountCents,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .where(inArray(saleItems.saleId, saleIds))
    .all();

  for (const { saleId, variantSize, variantColor, ...item } of rows) {
    const items = grouped.get(saleId) ?? [];
    items.push({ ...item, variantLabel: formatVariantLabel(variantSize || null, variantColor || null) });
    grouped.set(saleId, items);
  }

  return grouped;
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
