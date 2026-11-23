// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import QuotationScreen from "./QuotationScreen";
import { billDocument, createMockApi, customer, saleDetail } from "@/test/mock-api";
import type { QuotationDetailDto, StyleCraftApi } from "@/types/stylecraft-api";

const saved: QuotationDetailDto = {
  id: 4,
  quotationNumber: 4,
  customerId: null,
  customerName: "Madina Pharma",
  customerPhone: "0300-5555555",
  quotationDate: new Date(2026, 10, 23),
  validUntil: null,
  totalAmountCents: 1_950_000,
  notes: null,
  items: [
    { id: 1, position: 0, description: "Medicine box", qty: 1000, rateCents: 1_800, amountCents: 1_800_000 },
    { id: 2, position: 1, description: "Die cutting", qty: 1, rateCents: 150_000, amountCents: 150_000 },
  ],
  convertedSaleId: null,
  convertedBillNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("QuotationScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    window.localStorage.clear();
    const { items, ...row } = saved;
    api = createMockApi({
      contacts: { listCustomers: vi.fn().mockResolvedValue([customer({ id: 3, name: "Al Noor Traders" })]) },
      quotations: {
        nextNumber: vi.fn().mockResolvedValue(4),
        create: vi.fn().mockResolvedValue(saved),
        update: vi.fn().mockResolvedValue(saved),
        get: vi.fn().mockResolvedValue(saved),
        list: vi.fn().mockResolvedValue([{ ...row, itemCount: items.length, itemNames: items.map((item) => item.description) }]),
        convertToSale: vi.fn().mockResolvedValue(saleDetail({ id: 30, billNumber: 30, kind: "cash", customerName: "Madina Pharma" })),
      },
      invoices: { getBill: vi.fn().mockResolvedValue(billDocument({ id: 30, billNumber: 30, kind: "cash", customerName: "Madina Pharma" })) },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("saves a quotation for a party typed in by name and shows it on the bill book", async () => {
    render(<QuotationScreen />);
    await screen.findAllByText("Q-4");

    fireEvent.click(screen.getByLabelText("Naya naam likhein"));
    type("Name", "Madina Pharma");
    type("Phone", "0300-5555555");
    type("Date", "2026-11-23");
    type("Line 1 description", "Medicine box");
    type("Line 1 quantity", "1000");
    type("Line 1 rate", "18");
    fireEvent.click(screen.getByRole("button", { name: /add another line/i }));
    type("Line 2 description", "Die cutting");
    type("Line 2 quantity", "1");
    type("Line 2 rate", "1500");

    expect(screen.getByTestId("quotation-form-total")).toHaveTextContent("Rs. 19,500.00");

    fireEvent.click(screen.getByRole("button", { name: "Save quotation" }));

    await waitFor(() =>
      expect(api.quotations.create).toHaveBeenCalledWith({
        customerId: null,
        customerName: "Madina Pharma",
        customerPhone: "0300-5555555",
        quotationDate: "2026-11-23",
        validUntil: null,
        notes: null,
        items: [
          { description: "Medicine box", qty: 1000, rateCents: 1_800 },
          { description: "Die cutting", qty: 1, rateCents: 150_000 },
        ],
      }),
    );
    expect(await screen.findByText(/Quotation Q-4 saved/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Quotation preview" })).toBeInTheDocument();
    expect(screen.getByTestId("quotation-total")).toHaveTextContent("19,500/-");
  });

  it("asks for a customer from the list unless a name is typed", async () => {
    render(<QuotationScreen />);
    await screen.findAllByText("Q-4");

    type("Line 1 description", "Box");
    type("Line 1 quantity", "1");
    type("Line 1 rate", "10");
    fireEvent.click(screen.getByRole("button", { name: "Save quotation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Select the customer");
    expect(api.quotations.create).not.toHaveBeenCalled();
  });

  it("turns a pending quotation into a cash sale bill with an advance, and opens the bill", async () => {
    render(<QuotationScreen />);

    const row = (await screen.findByText("Medicine box, Die cutting")).closest("tr") as HTMLTableRowElement;
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Bill banayein" }));

    const panel = await screen.findByRole("region", { name: "Make bill from quotation" });
    expect(within(panel).getByText(/naya customer ban jayega/)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Bill date"), { target: { value: "2026-11-25" } });
    fireEvent.change(within(panel).getByLabelText("Advance received now"), { target: { value: "5000" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Bill banayein" }));

    await waitFor(() =>
      expect(api.quotations.convertToSale).toHaveBeenCalledWith(4, { saleDate: "2026-11-25", advanceCents: 500_000, advanceMethod: "cash", advanceReference: null }),
    );
    expect(await screen.findByText(/Quotation Q-4 is now Bill No. 30/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Cash sale bill preview" })).toBeInTheDocument();
  });

  it("loads a quotation back for editing", async () => {
    render(<QuotationScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    await waitFor(() => expect(screen.getByLabelText("Line 2 description")).toHaveValue("Die cutting"));
    expect(screen.getByLabelText("Naya naam likhein")).toBeChecked();
    expect(screen.getByLabelText("Name")).toHaveValue("Madina Pharma");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.quotations.update).toHaveBeenCalledWith(4, expect.objectContaining({ customerName: "Madina Pharma" })));
  });
});
