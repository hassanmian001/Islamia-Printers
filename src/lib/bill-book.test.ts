import { describe, expect, it } from "vitest";

import { billBookFileSuffix, buildBillHtml, buildQuotationHtml } from "./bill-book";
import { billDocument } from "@/test/mock-api";
import type { BillDocumentDto, QuotationDetailDto } from "@/types/stylecraft-api";

function cashBill(overrides: Partial<BillDocumentDto> = {}) {
  return billDocument({
    kind: "cash",
    billNumber: 7,
    jobs: [],
    items: [
      { id: 1, position: 0, description: "700g UV Round Corner Matt Card (500x2)", qty: 1000, rateCents: 1_300, amountCents: 1_300_000 },
      { id: 2, position: 1, description: "Envelopes", qty: 200, rateCents: 1_500, amountCents: 300_000 },
    ],
    totalAmountCents: 1_600_000,
    advanceCents: 800_000,
    advanceMethod: "online",
    balanceCents: 800_000,
    previousBalanceCents: 450_000,
    closingBalanceCents: 1_250_000,
    saleDate: new Date(2026, 10, 23),
    customerName: "360 Estate (Soban Raj)",
    customerPhone: "0300-1234567",
    ...overrides,
  });
}

describe("bill book page", () => {
  it("prints on A5 with the bill-book artwork behind the details", () => {
    const html = buildBillHtml(cashBill());

    expect(html).toContain("@page{size:148mm 210mm;margin:0}");
    expect(html).toContain('<img class="bg" src="data:image/jpeg;base64,');
    expect(html).toContain("23-11-2026");
    expect(html).toContain(">007<");
    expect(html).toContain("360 Estate (Soban Raj) (0300-1234567)");
    expect(html).toContain("700g UV Round Corner Matt Card (500x2)");
    expect(html).toContain(">1,000<");
    expect(html).toContain(">13<");
    expect(html).toContain("13,000/-");
  });

  it("fills TOTAL, P. Bal, ADV. and BAL. with the khata balance before and after the bill", () => {
    const html = buildBillHtml(cashBill());

    const totals = [...html.matchAll(/class="f total"[^>]*><span>([^<]+)<\/span>/g)].map((match) => match[1]);
    expect(totals).toEqual(["16,000/-", "4,500/-", "8,000/-", "12,500/-"]);
    expect(html).toContain("<small>ONLINE</small>");
  });

  it("prints only the details, in black, for a pre-printed bill-book page", () => {
    const html = buildBillHtml(cashBill(), { mode: "details", offsetXMm: 1.5, offsetYMm: -2 });

    expect(html).not.toContain('class="bg"');
    expect(html).toContain("color:#000");
    expect(html).toContain("transform:translate(1.5mm,-2mm)");
    expect(html).toContain("16,000/-");
  });

  it("ignores the printer offset when printing the whole page", () => {
    expect(buildBillHtml(cashBill(), { mode: "full", offsetXMm: 3, offsetYMm: 3 })).toContain("transform:translate(0mm,0mm)");
  });

  it("closes up the rows when a bill has many lines, so amounts stay above TOTAL", () => {
    const items = Array.from({ length: 24 }, (_, index) => ({ id: index + 1, position: index, description: `Item ${index + 1}`, qty: 1, rateCents: 100, amountCents: 100 }));
    const html = buildBillHtml(cashBill({ items }));
    const tops = [...html.matchAll(/class="f row\s*\s*l" style="left:[\d.]+mm;top:([\d.]+)mm/g)].map((match) => Number(match[1]));

    expect(tops).toHaveLength(24);
    // The TOTAL box starts 525.2 pt down the design, about 152.5 mm on the A5 page.
    expect(tops[23]).toBeLessThan(152.5);
  });

  it("escapes what the shop typed", () => {
    expect(buildBillHtml(cashBill({ customerName: "<script>alert(1)</script>" }))).not.toContain("<script>alert");
  });

  it("marks a details-only PDF in its file name", () => {
    expect(billBookFileSuffix("details")).toBe(" (details only)");
    expect(billBookFileSuffix("full")).toBe("");
  });
});

function quotation(overrides: Partial<QuotationDetailDto> = {}): QuotationDetailDto {
  return {
    id: 1,
    quotationNumber: 4,
    customerId: null,
    customerName: "Madina Pharma",
    customerPhone: "0300-5555555",
    quotationDate: new Date(2026, 10, 23),
    validUntil: new Date(2026, 10, 30),
    totalAmountCents: 1_950_000,
    notes: "Rates for 1000 boxes",
    items: [
      { id: 1, position: 0, description: "Medicine box 3 colour", qty: 1000, rateCents: 1_800, amountCents: 1_800_000 },
      { id: 2, position: 1, description: "Die cutting", qty: 1, rateCents: 150_000, amountCents: 150_000 },
    ],
    convertedSaleId: null,
    convertedBillNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("quotation page", () => {
  it("uses the bill-book page, headed QUOTATION and numbered Q-004, with only TOTAL filled", () => {
    const html = buildQuotationHtml(quotation());

    expect(html).toContain('<img class="bg"');
    expect(html).toContain(">QUOTATION<");
    expect(html).toContain(">Q-004<");
    expect(html).toContain("Madina Pharma (0300-5555555)");
    expect(html).toContain("Medicine box 3 colour");
    expect(html).toContain("18,000/-");
    expect(html).toContain("Valid till 30-11-2026 · Rates for 1000 boxes");
    const totals = [...html.matchAll(/class="f total"[^>]*><span>([^<]+)<\/span>/g)].map((match) => match[1]);
    expect(totals).toEqual(["19,500/-"]);
  });

  it("prints only the details for a pre-printed pad, heading included", () => {
    const html = buildQuotationHtml(quotation({ validUntil: null, notes: null }), { mode: "details" });

    expect(html).not.toContain('class="bg"');
    expect(html).toContain(">QUOTATION<");
    expect(html).not.toContain("Valid till");
  });
});
