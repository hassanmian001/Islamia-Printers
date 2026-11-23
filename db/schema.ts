import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// openingBalanceCents is what the customer already owed when they were first
// entered, before any bill in this database. Negative is money held in advance.
// The khata starts from this figure.
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    nameIdx: index("customers_name_idx").on(table.name),
  }),
);

// One sale bill (a voucher, "V.No" on the khata). It belongs to one customer.
// A "job" bill carries printing jobs (sale_jobs); a "cash" bill carries plain
// description / qty / rate lines (cash_sale_items). Either way its total is the
// sum of its lines, and both kinds share one run of bill numbers.
export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    billNumber: integer("bill_number").notNull(),
    kind: text("kind", { enum: ["job", "cash"] }).notNull().default("job"),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleDate: integer("sale_date", { mode: "timestamp_ms" }).notNull(),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    billNumberIdx: uniqueIndex("sales_bill_number_unique").on(table.billNumber),
    customerIdx: index("sales_customer_id_idx").on(table.customerId),
    dateIdx: index("sales_sale_date_idx").on(table.saleDate),
  }),
);

// One printing job on a bill. Each kind of work (Rota printing, GTO printing,
// cutting, lamination, dye) is charged as quantity x rate; the amount is kept
// as well so a later change to rounding never rewrites an old bill.
// Quantities are REAL because a job can be charged for half a ream or 2.5 packets.
export const saleJobs = sqliteTable(
  "sale_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    jobName: text("job_name").notNull(),
    rotaQty: real("rota_qty").notNull().default(0),
    rotaRateCents: integer("rota_rate_cents").notNull().default(0),
    rotaAmountCents: integer("rota_amount_cents").notNull().default(0),
    gtoQty: real("gto_qty").notNull().default(0),
    gtoRateCents: integer("gto_rate_cents").notNull().default(0),
    gtoAmountCents: integer("gto_amount_cents").notNull().default(0),
    cuttingQty: real("cutting_qty").notNull().default(0),
    cuttingRateCents: integer("cutting_rate_cents").notNull().default(0),
    cuttingAmountCents: integer("cutting_amount_cents").notNull().default(0),
    laminationQty: real("lamination_qty").notNull().default(0),
    laminationRateCents: integer("lamination_rate_cents").notNull().default(0),
    laminationAmountCents: integer("lamination_amount_cents").notNull().default(0),
    dyeQty: real("dye_qty").notNull().default(0),
    dyeRateCents: integer("dye_rate_cents").notNull().default(0),
    dyeAmountCents: integer("dye_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    saleIdx: index("sale_jobs_sale_id_idx").on(table.saleId),
  }),
);

// One line of a cash sale bill: description, quantity x rate = amount.
export const cashSaleItems = sqliteTable(
  "cash_sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    qty: real("qty").notNull().default(0),
    rateCents: integer("rate_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    saleIdx: index("cash_sale_items_sale_id_idx").on(table.saleId),
  }),
);

// Money received from a customer ("CR" on the khata), with its own receipt number.
// method is how it came in (cash in hand or online transfer); narration holds the
// detail (JazzCash, bank, TID...). saleId is set when the money is the advance
// taken on a bill: it then belongs to that bill and is changed by editing the bill.
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    receiptNumber: integer("receipt_number").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    paymentDate: integer("payment_date", { mode: "timestamp_ms" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: ["cash", "online"] }).notNull().default("cash"),
    narration: text("narration"),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    receiptNumberIdx: uniqueIndex("payments_receipt_number_unique").on(table.receiptNumber),
    customerIdx: index("payments_customer_id_idx").on(table.customerId),
    dateIdx: index("payments_payment_date_idx").on(table.paymentDate),
    saleIdx: index("payments_sale_id_idx").on(table.saleId),
  }),
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    actorName: text("actor_name"),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const schemaTableNames = ["audit_logs", "cash_sale_items", "customers", "payments", "sale_jobs", "sales", "settings"] as const;
