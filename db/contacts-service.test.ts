import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "./migrate";
import { ContactValidationError, createCustomer, deleteCustomer, listCustomers, updateCustomer, type ContactInput } from "./contacts-service";
import { recordPayment } from "./ledger-service";
import { createSale } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stylecraft-contacts-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

function makeContactInput(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Ali Khan",
    phone: "0300-0000000",
    email: "ali@example.com",
    address: "Lahore",
    notes: "Repeat buyer",
    ...overrides,
  };
}

describe("contacts service", () => {
  it("creates, lists, and searches customers", () => {
    const databasePath = makeTempDatabasePath();
    const ali = createCustomer(databasePath, makeContactInput({ name: "  Ali Khan  ", phone: "  0300  " }));
    createCustomer(databasePath, makeContactInput({ name: "Sara Ahmed", email: "sara@example.com", notes: "Wholesale" }));

    expect(ali).toMatchObject({ name: "Ali Khan", phone: "0300" });
    expect(listCustomers(databasePath).map((customer) => customer.name)).toEqual(["Ali Khan", "Sara Ahmed"]);
    expect(listCustomers(databasePath, { search: "wholesale" }).map((customer) => customer.name)).toEqual(["Sara Ahmed"]);
  });

  it("carries an old khata balance in and lets it be corrected later", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, makeContactInput({ name: "Kamran", openingBalanceCents: 30_000 }));

    expect(customer.openingBalanceCents).toBe(30_000);
    expect(updateCustomer(databasePath, customer.id, makeContactInput({ name: "Kamran", openingBalanceCents: 25_000 })).openingBalanceCents).toBe(25_000);
    expect(listCustomers(databasePath)[0].openingBalanceCents).toBe(25_000);
  });

  it("starts contacts at a zero opening balance and refuses a part-paisa figure", () => {
    const databasePath = makeTempDatabasePath();

    expect(createCustomer(databasePath, makeContactInput({ name: "Walk-in" })).openingBalanceCents).toBe(0);
    expect(() => createCustomer(databasePath, makeContactInput({ name: "Broken", openingBalanceCents: 10.5 }))).toThrow(ContactValidationError);
  });

  it("updates customers and rejects invalid inputs", () => {
    const databasePath = makeTempDatabasePath();
    const customer = createCustomer(databasePath, makeContactInput({ name: "Walk-in Customer" }));

    const updated = updateCustomer(databasePath, customer.id, makeContactInput({ name: "Walk-in Customer", phone: "" }));

    expect(updated.phone).toBeNull();
    expect(() => createCustomer(databasePath, makeContactInput({ name: "   " }))).toThrow(ContactValidationError);
    expect(() => updateCustomer(databasePath, 999, makeContactInput())).toThrow(ContactValidationError);
    expect(() => updateCustomer(databasePath, 0, makeContactInput())).toThrow(ContactValidationError);
  });

  it("deletes a customer entered by mistake, but never one with a khata", () => {
    const databasePath = makeTempDatabasePath();
    const mistake = createCustomer(databasePath, makeContactInput({ name: "Typo" }));
    const billed = createCustomer(databasePath, makeContactInput({ name: "Billed" }));
    const paid = createCustomer(databasePath, makeContactInput({ name: "Paid" }));
    const none = { qty: 0, rateCents: 0 };

    createSale(databasePath, {
      customerId: billed.id,
      saleDate: "2026-11-01",
      jobs: [{ jobName: "Cards", rota: { qty: 1, rateCents: 100 }, gto: none, cutting: none, lamination: none, dye: none }],
    });
    recordPayment(databasePath, { customerId: paid.id, amountCents: 100, paymentDate: "2026-11-01" });

    deleteCustomer(databasePath, mistake.id);

    expect(listCustomers(databasePath).map((customer) => customer.name)).toEqual(["Billed", "Paid"]);
    expect(() => deleteCustomer(databasePath, billed.id)).toThrow("cannot be deleted");
    expect(() => deleteCustomer(databasePath, paid.id)).toThrow("cannot be deleted");
    expect(() => deleteCustomer(databasePath, 999)).toThrow("Customer was not found.");
  });
});
