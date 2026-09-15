// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LedgerScreen from "./LedgerScreen";
import type { CustomerStatementDto, InvoiceApi, InvoiceDetailDto, LedgerApi, LedgerStatementDto, LedgerSummaryDto, PaidInFullSaleDto } from "@/types/stylecraft-api";

const summary: LedgerSummaryDto = {
  customers: [
    { partyType: "customer", partyId: 1, partyName: "Ali", phone: "0300-1112222", openingBalanceCents: 0, invoicedCents: 10_000, paidCents: 4_000, returnedCents: 0, balanceCents: 6_000 },
    { partyType: "customer", partyId: 2, partyName: "Settled Sohail", phone: null, openingBalanceCents: 0, invoicedCents: 5_000, paidCents: 5_000, returnedCents: 0, balanceCents: 0 },
    { partyType: "customer", partyId: 3, partyName: "Old Khata Kamran", phone: null, openingBalanceCents: 30_000, invoicedCents: 0, paidCents: 0, returnedCents: 0, balanceCents: 30_000 },
  ],
  suppliers: [
    { partyType: "supplier", partyId: 9, partyName: "Fabric House", phone: null, openingBalanceCents: 0, invoicedCents: 20_000, paidCents: 12_000, returnedCents: 0, balanceCents: 8_000 },
  ],
  customerReceivableCents: 36_000,
  supplierPayableCents: 8_000,
};

const statement: LedgerStatementDto = {
  ...summary.customers[0],
  entries: [
    { date: new Date("2026-08-01T00:00:00.000Z"), kind: "sale", reference: "INV-000001", description: "Sale invoice", saleId: 21, debitCents: 10_000, creditCents: 0, balanceCents: 10_000 },
    { date: new Date("2026-08-05T00:00:00.000Z"), kind: "payment", reference: "Cash", description: "Payment received", saleId: null, debitCents: 0, creditCents: 4_000, balanceCents: 6_000 },
  ],
};

const invoice: InvoiceDetailDto = {
  saleId: 21,
  invoiceNumber: "INV-000001",
  saleDate: new Date("2026-08-01T00:00:00.000Z"),
  customerName: "Ali",
  customerPhone: "0300-1112222",
  customerEmail: null,
  customerAddress: null,
  subtotalCents: 10_000,
  discountAmountCents: 0,
  totalAmountCents: 10_000,
  paymentMethod: "Cash",
  notes: null,
  business: {
  businessName: "StyleCraft Lahore",
  phone: "0300-0000000",
  email: "sales@stylecraft.test",
  address: "Lahore",
  currencySymbol: "Rs.",
  invoicePrefix: "INV",
},
  items: [
    {
      id: 1,
      productId: 5,
      variantLabel: "M / Blue",
      productName: "Oxford Shirt",
      productSku: "OX-001-M-BLUE",
      quantity: 2,
      unitPriceCents: 5_000,
      discountAmountCents: 0,
      totalAmountCents: 10_000,
    },
  ],
};

const customerStatement: CustomerStatementDto = {
  customerId: 1,
  customerName: "Ali",
  customerPhone: "0300-1112222",
  customerEmail: null,
  customerAddress: null,
  generatedAt: new Date("2026-09-15T00:00:00.000Z"),
  openingBalanceCents: 0,
  invoicedCents: 10_000,
  paidCents: 4_000,
  returnedCents: 0,
  balanceCents: 6_000,
  business: {
  businessName: "StyleCraft Lahore",
  phone: "0300-0000000",
  email: "sales@stylecraft.test",
  address: "Lahore",
  currencySymbol: "Rs.",
  invoicePrefix: "INV",
},
  entries: [
    {
      ...statement.entries[0],
      sale: {
        saleId: 21,
        invoiceNumber: "INV-000001",
        saleDate: new Date("2026-08-01T00:00:00.000Z"),
        subtotalCents: 10_000,
        discountAmountCents: 0,
        totalAmountCents: 10_000,
        paymentMethod: "Cash",
        notes: null,
        items: invoice.items,
      },
    },
    { ...statement.entries[1], sale: null },
  ],
};

const paidInFullSales: PaidInFullSaleDto[] = [
  {
    saleId: 11,
    invoiceNumber: "INV-000011",
    customerId: 1,
    customerName: "Ali",
    saleDate: new Date("2026-08-09T00:00:00.000Z"),
    totalAmountCents: 5_000,
    amountPaidCents: 5_000,
    paymentMethod: null,
    notes: null,
  },
  {
    saleId: 12,
    invoiceNumber: "INV-000012",
    customerId: null,
    customerName: null,
    saleDate: new Date("2026-08-10T00:00:00.000Z"),
    totalAmountCents: 2_000,
    amountPaidCents: 2_000,
    paymentMethod: "Cash",
    notes: null,
  },
];

describe("LedgerScreen", () => {
  let ledgerApi: LedgerApi;
  let invoicesApi: InvoiceApi;

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    ledgerApi = {
      getSummary: vi.fn().mockResolvedValue(summary),
      getStatement: vi.fn().mockResolvedValue(statement),
      recordPayment: vi.fn().mockResolvedValue({}),
      deletePayment: vi.fn().mockResolvedValue(undefined),
      listPaidInFullSales: vi.fn().mockResolvedValue([]),
      moveSalesToKhata: vi.fn().mockResolvedValue({ movedCount: 0, movedAmountCents: 0, skippedSaleIds: [] }),
    };

    invoicesApi = {
      getBySaleId: vi.fn().mockResolvedValue(invoice),
      getCustomerStatement: vi.fn().mockResolvedValue(customerStatement),
      getFolder: vi.fn().mockResolvedValue({ folder: "D:/Invoices", isDefaultFolder: false }),
      chooseFolder: vi.fn().mockResolvedValue(null),
      updateFolder: vi.fn().mockResolvedValue({ folder: "D:/Invoices", isDefaultFolder: false }),
      savePdf: vi.fn().mockResolvedValue({ filePath: "D:/Invoices/INV-000001 Ali.pdf", folder: "D:/Invoices" }),
      reveal: vi.fn().mockResolvedValue(undefined),
    };

    window.stylecraft = { ledger: ledgerApi, invoices: invoicesApi } as unknown as typeof window.stylecraft;
  });

  it("lists every customer, settled ones included, so nobody goes missing", async () => {
    render(<LedgerScreen />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("Settled Sohail")).toBeInTheDocument();
    expect(screen.getByText("Total receivable")).toBeInTheDocument();
  });

  it("hides settled accounts once the tick is taken off", async () => {
    render(<LedgerScreen />);

    await screen.findByText("Ali");
    fireEvent.click(screen.getByLabelText("Show settled accounts"));

    await waitFor(() => {
      expect(screen.queryByText("Settled Sohail")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Ali")).toBeInTheDocument();
  });

  it("carries an opening balance into what a customer owes", async () => {
    render(<LedgerScreen />);

    const row = (await screen.findByText("Old Khata Kamran")).closest("tr");
    // The opening figure and the balance it produces both read Rs. 300.00.
    expect(within(row as HTMLTableRowElement).getAllByText("Rs. 300.00")).toHaveLength(2);
  });

  it("switches to what the shop owes suppliers", async () => {
    render(<LedgerScreen />);

    await screen.findByText("Ali");
    fireEvent.click(screen.getByRole("button", { name: "We owe suppliers" }));

    expect(await screen.findByText("Fabric House")).toBeInTheDocument();
    expect(screen.getByText("Total payable")).toBeInTheDocument();
  });

  it("opens a running statement when a row is clicked", async () => {
    render(<LedgerScreen />);

    const row = (await screen.findByText("Ali")).closest("tr");
    fireEvent.click(row as HTMLElement);

    await waitFor(() => {
      expect(ledgerApi.getStatement).toHaveBeenCalledWith("customer", 1);
    });

    expect(await screen.findByText("INV-000001")).toBeInTheDocument();
    expect(screen.getByText("Sale")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("records a payment against the open account", async () => {
    render(<LedgerScreen />);

    const row = (await screen.findByText("Ali")).closest("tr");
    fireEvent.click(row as HTMLElement);

    await screen.findByText("INV-000001");

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Final settlement" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    await waitFor(() => {
      expect(ledgerApi.recordPayment).toHaveBeenCalledWith(
        expect.objectContaining({ partyType: "customer", partyId: 1, amountCents: 6_000, notes: "Final settlement" }),
      );
    });
  });

  it("refuses a payment with no amount", async () => {
    render(<LedgerScreen />);

    const row = (await screen.findByText("Ali")).closest("tr");
    fireEvent.click(row as HTMLElement);

    await screen.findByText("INV-000001");
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Payment amount must be more than zero.");
    expect(ledgerApi.recordPayment).not.toHaveBeenCalled();
  });
  it("opens the invoice behind a khata line, with every item on it", async () => {
    render(<LedgerScreen />);

    fireEvent.click((await screen.findByText("Ali")).closest("tr") as HTMLElement);
    await screen.findByText("INV-000001");
    fireEvent.click(screen.getByRole("button", { name: "View" }));

    await waitFor(() => {
      expect(invoicesApi.getBySaleId).toHaveBeenCalledWith(21);
    });

    const preview = await screen.findByRole("region", { name: "Invoice preview" });
    expect(within(preview).getByText("Invoice INV-000001")).toBeInTheDocument();
    expect(within(preview).getByText("Oxford Shirt")).toBeInTheDocument();
    expect(within(preview).getByText("M / Blue")).toBeInTheDocument();
  });

  it("saves the open invoice as a PDF and says where it went", async () => {
    render(<LedgerScreen />);

    fireEvent.click((await screen.findByText("Ali")).closest("tr") as HTMLElement);
    await screen.findByText("INV-000001");
    fireEvent.click(screen.getByRole("button", { name: "View" }));

    const preview = await screen.findByRole("region", { name: "Invoice preview" });
    fireEvent.click(within(preview).getByRole("button", { name: "Download PDF" }));

    await waitFor(() => {
      expect(invoicesApi.savePdf).toHaveBeenCalledWith(expect.objectContaining({ fileName: "INV-000001 Ali", saveAs: false }));
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Saved to D:/Invoices/INV-000001 Ali.pdf");
  });

  it("opens the whole khata as one statement with the items under each invoice", async () => {
    render(<LedgerScreen />);

    fireEvent.click((await screen.findByText("Ali")).closest("tr") as HTMLElement);
    await screen.findByText("INV-000001");
    fireEvent.click(screen.getByRole("button", { name: "View full statement" }));

    await waitFor(() => {
      expect(invoicesApi.getCustomerStatement).toHaveBeenCalledWith(1);
    });

    const preview = await screen.findByRole("region", { name: "Account statement preview" });
    expect(within(preview).getByText("Item details")).toBeInTheDocument();
    expect(within(preview).getByText("Oxford Shirt")).toBeInTheDocument();
    expect(within(preview).getByText("Balance due")).toBeInTheDocument();
  });

  it("keeps the full statement button away from supplier khatas", async () => {
    render(<LedgerScreen />);

    await screen.findByText("Ali");
    fireEvent.click(screen.getByRole("button", { name: "We owe suppliers" }));
    fireEvent.click((await screen.findByText("Fabric House")).closest("tr") as HTMLElement);

    await screen.findByText("INV-000001");
    expect(screen.queryByRole("button", { name: "View full statement" })).not.toBeInTheDocument();
  });

  describe("sales recorded as paid in full", () => {
    it("stays out of the way when no sale is recorded as paid in full", async () => {
      render(<LedgerScreen />);

      await screen.findByText("Ali");
      expect(screen.queryByText("Sales recorded as paid in full")).not.toBeInTheDocument();
    });

    it("moves the ticked sales onto the khata and leaves customer-less ones alone", async () => {
      ledgerApi.listPaidInFullSales = vi.fn().mockResolvedValue(paidInFullSales);
      ledgerApi.moveSalesToKhata = vi.fn().mockResolvedValue({ movedCount: 1, movedAmountCents: 5_000, skippedSaleIds: [] });

      render(<LedgerScreen />);

      await screen.findByText("Sales recorded as paid in full");
      fireEvent.click(screen.getByRole("button", { name: "Review" }));

      expect(await screen.findByText("INV-000011")).toBeInTheDocument();
      expect(screen.getByLabelText("Move INV-000011 onto the khata")).toBeChecked();
      expect(screen.getByLabelText("Move INV-000012 onto the khata")).toBeDisabled();
      expect(screen.getByText("1 sale has no customer and cannot carry a balance.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Move 1 sale onto the khata (Rs. 50.00)" }));
      fireEvent.click(screen.getByRole("button", { name: "Yes, move 1 onto the khata" }));

      await waitFor(() => {
        expect(ledgerApi.moveSalesToKhata).toHaveBeenCalledWith([11]);
      });
      expect(await screen.findByRole("status")).toHaveTextContent("1 sale worth Rs. 50.00 moved onto the khata.");
    });

    it("does not move anything until the confirmation is clicked", async () => {
      ledgerApi.listPaidInFullSales = vi.fn().mockResolvedValue(paidInFullSales);

      render(<LedgerScreen />);

      await screen.findByText("Sales recorded as paid in full");
      fireEvent.click(screen.getByRole("button", { name: "Review" }));
      fireEvent.click(await screen.findByRole("button", { name: "Move 1 sale onto the khata (Rs. 50.00)" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(ledgerApi.moveSalesToKhata).not.toHaveBeenCalled();
    });
  });
});
