import { describe, expect, it } from "vitest";

import { schemaTableNames } from "./schema";

describe("database schema", () => {
  it("defines the job-sales and khata tables only", () => {
    expect([...schemaTableNames].sort()).toEqual(["audit_logs", "cash_sale_items", "customers", "payments", "quotation_items", "quotations", "sale_jobs", "sales", "settings"]);
  });
});
