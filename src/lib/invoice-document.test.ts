import { describe, expect, it } from "vitest";

import { billDocumentFileName, buildBillHtml, buildLedgerHtml, escapeHtml, ledgerDocumentFileName } from "./invoice-document";
import { billDocument, charge, ledgerStatement, saleJob } from "@/test/mock-api";

describe("bill document", () => {
  it("lists every job with each kind of work as qty x rate and the bill total", () => {
    const html = buildBillHtml(
      billDocument({
        jobs: [saleJob({ jobName: "Visiting cards" }), saleJob({ id: 2, jobName: "Letterhead", rota: charge(0, 0), cutting: charge(0, 0), gto: charge(2.5, 120_000) })],
        totalAmountCents: 505_000,
        notes: "Deliver Friday",
      }),
    );

    expect(html).toContain("Bill No. 15");
    expect(html).toContain("Islamia Press");
    expect(html).toContain("Visiting cards");
    expect(html).toContain("1,000 × 2");
    expect(html).toContain("2.5 × 1,200");
    expect(html).toContain("Rota P");
    expect(html).toContain("Lamination");
    expect(html).toContain("Rs. 5,050.00");
    expect(html).toContain("Deliver Friday");
  });

  it("escapes what the shop typed", () => {
    const html = buildBillHtml(billDocument({ customerName: "<script>alert(1)</script>" }));

    expect(html).not.toContain("<script>alert");
    expect(escapeHtml(`"A" & 'B'`)).toBe("&quot;A&quot; &amp; &#039;B&#039;");
  });

  it("names the file after the bill and customer", () => {
    expect(billDocumentFileName(billDocument())).toBe("Bill 15 Islamia Press");
  });
});

describe("ledger document", () => {
  it("lays the khata out like a statement of account", () => {
    const html = buildLedgerHtml(ledgerStatement());

    expect(html).toContain("Statement of Account");
    expect(html).toContain("size:A4 landscape");
    expect(html).toContain("01/10/2026");
    expect(html).toContain("16/11/2026");
    expect(html).toContain("A/C No. 1");
    expect(html).toContain("A/C Title : Islamia Press 0300-6609031");
    expect(html).toContain("Opening Balance");
    expect(html).toContain("30/09/2026"); // the opening balance sits on the day before the period
    expect(html).toContain("209,091");
    expect(html).toContain("15 SV");
    expect(html).toContain("Sub-Total &gt;&gt;&gt;&gt;&gt;");
    expect(html).toContain("1003 CR");
    expect(html).toContain("mzn");
    expect(html).toContain("Grand Total");
    expect(html).toContain("Final Balance");
    expect(html).toContain("161,141");
    expect(html).toContain("Prepared by");
    expect(html).toContain("Received by");
  });

  it("says so when the period has no entries", () => {
    const html = buildLedgerHtml(ledgerStatement({ entries: [], startDate: null, endDate: null }));

    expect(html).toContain("No bills or payments in this period.");
    expect(html).toContain("Beginning");
  });

  it("names the file after the customer and period", () => {
    expect(ledgerDocumentFileName(ledgerStatement())).toBe("Ledger Islamia Press 01-10-2026 to 16-11-2026");
  });
});
