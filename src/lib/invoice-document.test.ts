import { describe, expect, it } from "vitest";

import { billDocumentFileName, billLines, billNumberLabel, buildLedgerHtml, escapeHtml, ledgerDocumentFileName, paymentNarration } from "./invoice-document";
import { billDocument, charge, ledgerStatement, saleJob } from "@/test/mock-api";

describe("bill document", () => {
  it("turns a job into Description / Qty / Rate / Amount lines", () => {
    const lines = billLines(
      billDocument({
        jobs: [saleJob({ jobName: "Visiting cards" }), saleJob({ id: 2, jobName: "Letterhead", rota: charge(0, 0), cutting: charge(0, 0), gto: charge(2.5, 120_000) })],
      }),
    );

    expect(lines).toEqual([
      { kind: "head", description: "Visiting cards", qty: null, rateCents: null, amountCents: null },
      { kind: "sub", description: "Rota P", qty: 1000, rateCents: 200, amountCents: 200_000 },
      { kind: "sub", description: "Cutting", qty: 1, rateCents: 5_000, amountCents: 5_000 },
      { kind: "line", description: "Letterhead — GTO P", qty: 2.5, rateCents: 120_000, amountCents: 300_000 },
    ]);
  });

  it("escapes what the shop typed", () => {
    expect(escapeHtml(`"A" & 'B'`)).toBe("&quot;A&quot; &amp; &#039;B&#039;");
  });

  it("names the file after the bill and customer", () => {
    expect(billDocumentFileName(billDocument())).toBe("Bill 15 Islamia Press");
  });

  it("describes a payment: advance or not, cash or online, and its detail", () => {
    expect(paymentNarration({ method: "online", narration: "JazzCash TID 1", billNumber: 16 })).toBe("Advance (Bill 16) · Online · JazzCash TID 1");
    expect(paymentNarration({ method: "cash", narration: null, billNumber: null })).toBe("Cash");
    expect(billNumberLabel(16, "cash")).toBe("16 CS");
    expect(billNumberLabel(15)).toBe("15 SV");
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
