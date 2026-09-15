import { describe, expect, it } from "vitest";

import { buildInvoiceHtml, buildStatementHtml, escapeHtml, invoiceDocumentFileName, statementDocumentFileName } from "./invoice-document";
import type { CustomerStatementDto, InvoiceDetailDto, InvoiceLineItemDto } from "@/types/stylecraft-api";

const business = {
  businessName: "StyleCraft Lahore",
  phone: "0300-0000000",
  email: "sales@stylecraft.test",
  address: "Lahore",
  currencySymbol: "Rs.",
  invoicePrefix: "INV",
};

const items: InvoiceLineItemDto[] = [
  { id: 1, productId: 5, variantLabel: "M / Blue", productName: "Oxford Shirt", productSku: "OX-001-M", quantity: 2, unitPriceCents: 5_000, discountAmountCents: 0, totalAmountCents: 10_000 },
  { id: 2, productId: 6, variantLabel: "L / Black", productName: "Denim Jacket", productSku: "DJ-002-L", quantity: 1, unitPriceCents: 8_000, discountAmountCents: 1_000, totalAmountCents: 7_000 },
];

const invoice: InvoiceDetailDto = {
  saleId: 21,
  invoiceNumber: "INV-000001",
  saleDate: new Date("2026-08-01T00:00:00.000Z"),
  customerName: "Ali",
  customerPhone: "0300-1112222",
  customerEmail: null,
  customerAddress: null,
  subtotalCents: 18_000,
  discountAmountCents: 1_000,
  totalAmountCents: 17_000,
  paymentMethod: "Cash",
  notes: "Delivered by hand",
  business,
  items,
};

const statement: CustomerStatementDto = {
  customerId: 1,
  customerName: "Ali",
  customerPhone: "0300-1112222",
  customerEmail: null,
  customerAddress: null,
  generatedAt: new Date("2026-09-15T00:00:00.000Z"),
  openingBalanceCents: 30_000,
  invoicedCents: 17_000,
  paidCents: 5_000,
  returnedCents: 0,
  balanceCents: 42_000,
  business,
  entries: [
    { date: new Date("2026-07-01T00:00:00.000Z"), kind: "opening", reference: "Opening", description: "Balance carried over from before", saleId: null, debitCents: 30_000, creditCents: 0, balanceCents: 30_000, sale: null },
    {
      date: new Date("2026-08-01T00:00:00.000Z"),
      kind: "sale",
      reference: "INV-000001",
      description: "Sale invoice",
      saleId: 21,
      debitCents: 17_000,
      creditCents: 0,
      balanceCents: 47_000,
      sale: {
        saleId: 21,
        invoiceNumber: "INV-000001",
        saleDate: new Date("2026-08-01T00:00:00.000Z"),
        subtotalCents: 18_000,
        discountAmountCents: 1_000,
        totalAmountCents: 17_000,
        paymentMethod: "Cash",
        notes: null,
        items,
      },
    },
    { date: new Date("2026-08-05T00:00:00.000Z"), kind: "payment", reference: "Cash", description: "Payment received", saleId: null, debitCents: 0, creditCents: 5_000, balanceCents: 42_000, sale: null },
  ],
};

describe("invoice document", () => {
  it("prints every line item with its size, quantity and amount", () => {
    const html = buildInvoiceHtml(invoice);

    expect(html).toContain("Invoice INV-000001");
    expect(html).toContain("Oxford Shirt");
    expect(html).toContain("M / Blue");
    expect(html).toContain("Denim Jacket");
    // Two shirts and one jacket: the footer adds the quantities up.
    expect(html).toContain("<td class=\"num\">3</td>");
    expect(html).toContain("Rs. 170.00");
    expect(html).toContain("Delivered by hand");
  });

  it("names a walk-in buyer rather than leaving the bill-to box empty", () => {
    const html = buildInvoiceHtml({ ...invoice, customerName: null, customerPhone: null });

    expect(html).toContain("Walk-in customer");
  });

  it("escapes anything a product or customer name brings with it", () => {
    const html = buildInvoiceHtml({ ...invoice, customerName: "<script>alert('x')</script>" });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml('a & b "c"')).toBe("a &amp; b &quot;c&quot;");
  });

  it("puts the khata, the balance and each invoice's items into one statement", () => {
    const html = buildStatementHtml(statement);

    expect(html).toContain("Account statement");
    expect(html).toContain("Opening balance");
    expect(html).toContain("Balance due");
    expect(html).toContain("Rs. 420.00");
    expect(html).toContain("Item details");
    expect(html).toContain("Oxford Shirt");
  });

  it("leaves out the item details when there is nothing but an opening balance", () => {
    const html = buildStatementHtml({ ...statement, entries: [statement.entries[0]] });

    expect(html).not.toContain("Item details");
    expect(html).toContain("Opening balance");
  });

  it("builds file names a customer can recognise", () => {
    expect(invoiceDocumentFileName(invoice)).toBe("INV-000001 Ali");
    expect(invoiceDocumentFileName({ ...invoice, customerName: null })).toBe("INV-000001 Walk-in");
    expect(statementDocumentFileName(statement)).toBe("Statement Ali 15 Sept 2026");
  });
});
