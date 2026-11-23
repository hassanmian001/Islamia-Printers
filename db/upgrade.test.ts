import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDb } from "./client";
import { createCustomer, listCustomers } from "./contacts-service";
import { getLedgerStatement, listPayments } from "./ledger-service";
import { runMigrations } from "./migrate";
import { createSale, listSales } from "./sales-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

type Journal = { entries: { tag: string }[] };

/** The first migration of the job-sales rebuild; everything before it is the old stock app. */
const firstJobSalesMigrationTag = "0005_drop_inventory_tables";

/**
 * Runs the real migrator against a folder holding only the old stock-app
 * migrations, so the database ends up where an installed copy of that version
 * sits, including the bookkeeping that stops them re-running.
 */
function migrateToStockApp(databasePath: string, stopBeforeTag = firstJobSalesMigrationTag) {
  const source = path.resolve("drizzle");
  const journal: Journal = JSON.parse(fs.readFileSync(path.join(source, "meta/_journal.json"), "utf8"));
  const cutoff = journal.entries.findIndex((entry) => entry.tag === stopBeforeTag);

  if (cutoff === -1) {
    throw new Error(`Migration ${stopBeforeTag} is missing.`);
  }

  const previous = journal.entries.slice(0, cutoff);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-old-migrations-"));
  tempDirs.push(folder);
  fs.mkdirSync(path.join(folder, "meta"), { recursive: true });
  fs.writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: previous }));

  for (const entry of previous) {
    fs.copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  }

  const { sqlite, db } = createDb(databasePath);

  try {
    migrate(db, { migrationsFolder: folder });
  } finally {
    sqlite.close();
  }
}

/** A stock-app database with the kind of test records it would have, all linked by foreign keys. */
function makeStockAppDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-upgrade-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");

  migrateToStockApp(databasePath);

  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    INSERT INTO categories (id, name) VALUES (1, 'Paper');
    INSERT INTO products (id, name, sku, category_id, purchase_price_cents, selling_price_cents, current_stock, low_stock_threshold, is_active)
    VALUES (1, 'Offset 23x36', 'OFF-1', 1, 150000, 250000, 12, 3, 1);
    INSERT INTO product_variants (id, product_id, sku, current_stock) VALUES (1, 1, 'OFF-1', 12);
    INSERT INTO customers (id, name, phone, opening_balance_cents) VALUES (1, 'Old Customer', '0300-1234567', 5000);
    INSERT INTO suppliers (id, name) VALUES (1, 'Paper Mart');
    INSERT INTO sales (id, invoice_number, customer_id, sale_date, subtotal_cents, total_amount_cents, profit_amount_cents)
    VALUES (1, 'INV-000001', 1, 1750000000000, 250000, 250000, 100000);
    INSERT INTO sale_items (id, sale_id, product_id, variant_id, quantity, unit_price_cents, unit_cost_cents, total_amount_cents, profit_amount_cents)
    VALUES (1, 1, 1, 1, 1, 250000, 150000, 250000, 100000);
    INSERT INTO purchases (id, supplier_id, purchase_date, total_amount_cents) VALUES (1, 1, 1749000000000, 600000);
    INSERT INTO purchase_items (id, purchase_id, product_id, variant_id, quantity, unit_cost_cents, total_cost_cents) VALUES (1, 1, 1, 1, 4, 150000, 600000);
    INSERT INTO sale_returns (id, sale_id, return_date, total_amount_cents) VALUES (1, 1, 1751000000000, 250000);
    INSERT INTO sale_return_items (id, sale_return_id, sale_item_id, product_id, quantity, unit_price_cents, total_amount_cents, profit_reversal_cents)
    VALUES (1, 1, 1, 1, 1, 250000, 250000, 100000);
    INSERT INTO purchase_returns (id, purchase_id, return_date, total_amount_cents) VALUES (1, 1, 1751000000000, 150000);
    INSERT INTO purchase_return_items (id, purchase_return_id, purchase_item_id, product_id, quantity, unit_cost_cents, total_cost_cents)
    VALUES (1, 1, 1, 1, 1, 150000, 150000);
    INSERT INTO stock_movements (id, product_id, variant_id, movement_type, reference_type, reference_id, quantity_change, stock_before, stock_after)
    VALUES (1, 1, 1, 'sale', 'sale', 1, -1, 13, 12);
    INSERT INTO payments (id, party_type, party_id, direction, amount_cents, payment_date, sale_id) VALUES (1, 'customer', 1, 'in', 1000, 1750000000000, 1);
    INSERT INTO settings (key, value) VALUES ('business.name', 'Islamia Printers FSD');
    INSERT INTO audit_logs (action, entity_type) VALUES ('product.created', 'product');
  `);
  db.close();

  return databasePath;
}

function tableNames(databasePath: string) {
  const db = new Database(databasePath);
  const names = (db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'").all() as { name: string }[]).map(
    (row) => row.name,
  );
  db.close();
  return names.sort();
}

describe("upgrading from the stock app", () => {
  it("clears out products, stock, purchases, suppliers and returns", () => {
    const databasePath = makeStockAppDatabase();

    runMigrations(databasePath);

    expect(tableNames(databasePath)).toEqual(["audit_logs", "cash_sale_items", "customers", "payments", "sale_jobs", "sales", "settings"]);
    expect(listCustomers(databasePath)).toEqual([]);
  });

  it("keeps the shop's settings and its audit trail", () => {
    const databasePath = makeStockAppDatabase();

    runMigrations(databasePath);

    const db = new Database(databasePath);
    expect(db.prepare("select value from settings where key = 'business.name'").get()).toEqual({ value: "Islamia Printers FSD" });
    expect(db.prepare("select count(*) as count from audit_logs").get()).toEqual({ count: 1 });
    db.close();
  });

  it("runs the job-sales workflow on the upgraded database", () => {
    const databasePath = makeStockAppDatabase();

    runMigrations(databasePath);
    const customer = createCustomer(databasePath, { name: "New Customer" });
    createSale(databasePath, {
      customerId: customer.id,
      saleDate: "2026-11-22",
      jobs: [{ jobName: "Cards", rota: { qty: 1000, rateCents: 150 }, gto: { qty: 0, rateCents: 0 }, cutting: { qty: 0, rateCents: 0 }, lamination: { qty: 0, rateCents: 0 }, dye: { qty: 0, rateCents: 0 } }],
    });

    expect(getLedgerStatement(databasePath, customer.id).closingBalanceCents).toBe(150_000);
  });

  it("builds the same tables from scratch on a new install", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-fresh-"));
    tempDirs.push(dir);
    const databasePath = path.join(dir, "test.sqlite");

    runMigrations(databasePath);

    expect(tableNames(databasePath)).toEqual(["audit_logs", "cash_sale_items", "customers", "payments", "sale_jobs", "sales", "settings"]);
  });

  it("keeps v1.1 bills and payments when cash sales arrive, as job bills and cash payments", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-v11-"));
    tempDirs.push(dir);
    const databasePath = path.join(dir, "test.sqlite");
    migrateToStockApp(databasePath, "0007_cash_sales_and_payment_method");

    const db = new Database(databasePath);
    db.exec(`
      INSERT INTO customers (id, name, opening_balance_cents) VALUES (1, 'Ali', 0);
      INSERT INTO sales (id, bill_number, customer_id, sale_date, total_amount_cents) VALUES (1, 1, 1, 1795000000000, 50000);
      INSERT INTO sale_jobs (sale_id, job_name, rota_qty, rota_rate_cents, rota_amount_cents, total_amount_cents) VALUES (1, 'Cards', 100, 500, 50000, 50000);
      INSERT INTO payments (receipt_number, customer_id, payment_date, amount_cents, narration) VALUES (1, 1, 1795100000000, 20000, 'mzn');
    `);
    db.close();

    runMigrations(databasePath);

    expect(listSales(databasePath)[0]).toMatchObject({ kind: "job", billNumber: 1, advanceCents: 0, balanceCents: 50000 });
    expect(listPayments(databasePath)[0]).toMatchObject({ method: "cash", narration: "mzn", saleId: null });
    expect(getLedgerStatement(databasePath, 1).closingBalanceCents).toBe(30000);
  });
});
