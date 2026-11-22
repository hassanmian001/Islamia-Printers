import { eq, sql } from "drizzle-orm";

import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";
import { customers, payments, sales } from "./schema.js";

export type ContactInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  /** What the customer already owed before any bill here. Negative is money held in advance. */
  openingBalanceCents?: number;
};

export type ContactListFilters = {
  search?: string;
};

export type ContactDto = ContactInput & {
  id: number;
  openingBalanceCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactValidationError";
  }
}

function nullableTrimmed(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeContactInput(input: ContactInput) {
  const name = input.name.trim();

  if (!name) {
    throw new ContactValidationError("Customer name is required.");
  }

  const openingBalanceCents = input.openingBalanceCents ?? 0;

  // A shop that already keeps a khata on paper needs to carry that figure in,
  // so this is allowed to be negative (an advance) as well as positive.
  if (!Number.isInteger(openingBalanceCents)) {
    throw new ContactValidationError("Opening balance must be an amount.");
  }

  return {
    name,
    phone: nullableTrimmed(input.phone),
    email: nullableTrimmed(input.email),
    address: nullableTrimmed(input.address),
    notes: nullableTrimmed(input.notes),
    openingBalanceCents,
  };
}

function validateId(id: number, label: string) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ContactValidationError(`${label} must be a positive whole number.`);
  }
}

function matchesSearch(contact: ContactDto, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [contact.name, contact.phone, contact.email, contact.address, contact.notes].some((value) =>
    (value ?? "").toLowerCase().includes(normalizedSearch),
  );
}

function toCustomerDto(row: typeof customers.$inferSelect): ContactDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    openingBalanceCents: row.openingBalanceCents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCustomers(databasePath?: string, filters: ContactListFilters = {}): ContactDto[] {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    return db
      .select()
      .from(customers)
      .orderBy(customers.name)
      .all()
      .map(toCustomerDto)
      .filter((customer) => matchesSearch(customer, filters.search ?? ""));
  } finally {
    sqlite.close();
  }
}

export function createCustomer(databasePath: string | undefined, input: ContactInput): ContactDto {
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const normalizedInput = normalizeContactInput(input);
    const insertedCustomer = db.insert(customers).values(normalizedInput).returning({ id: customers.id }).get();
    const customer = db.select().from(customers).where(eq(customers.id, insertedCustomer.id)).get();

    if (customer === undefined) {
      throw new ContactValidationError("Customer was not found after creation.");
    }

    return toCustomerDto(customer);
  } finally {
    sqlite.close();
  }
}

export function updateCustomer(databasePath: string | undefined, id: number, input: ContactInput): ContactDto {
  validateId(id, "Customer");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const normalizedInput = normalizeContactInput(input);
    const result = db.update(customers).set({ ...normalizedInput, updatedAt: new Date() }).where(eq(customers.id, id)).run();

    if (result.changes === 0) {
      throw new ContactValidationError("Customer was not found.");
    }

    const customer = db.select().from(customers).where(eq(customers.id, id)).get();

    if (customer === undefined) {
      throw new ContactValidationError("Customer was not found after update.");
    }

    return toCustomerDto(customer);
  } finally {
    sqlite.close();
  }
}

/**
 * Removes a customer entered by mistake. One with any bill or payment on their
 * khata is kept, because deleting them would silently rewrite that history.
 */
export function deleteCustomer(databasePath: string | undefined, id: number): void {
  validateId(id, "Customer");
  runMigrations(databasePath);
  const { sqlite, db } = createDb(databasePath);

  try {
    const billCount = db.select({ count: sql<number>`count(*)` }).from(sales).where(eq(sales.customerId, id)).get()?.count ?? 0;
    const paymentCount = db.select({ count: sql<number>`count(*)` }).from(payments).where(eq(payments.customerId, id)).get()?.count ?? 0;

    if (billCount > 0 || paymentCount > 0) {
      throw new ContactValidationError("This customer has bills or payments on their khata, so they cannot be deleted.");
    }

    const result = db.delete(customers).where(eq(customers.id, id)).run();

    if (result.changes === 0) {
      throw new ContactValidationError("Customer was not found.");
    }
  } finally {
    sqlite.close();
  }
}
