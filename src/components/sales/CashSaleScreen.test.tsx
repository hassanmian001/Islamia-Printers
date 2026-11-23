// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashSaleScreen from "./CashSaleScreen";
import { billDocument, createMockApi, customer, saleDetail } from "@/test/mock-api";
import type { StyleCraftApi } from "@/types/stylecraft-api";

const cashBill = saleDetail({
  id: 9,
  billNumber: 21,
  kind: "cash",
  jobs: [],
  items: [{ id: 1, position: 0, description: "700g UV Card", qty: 1000, rateCents: 1_300, amountCents: 1_300_000 }],
  totalAmountCents: 1_300_000,
  advanceCents: 650_000,
  advanceMethod: "online",
  advanceReference: "JazzCash",
  balanceCents: 650_000,
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("CashSaleScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    api = createMockApi({
      contacts: { listCustomers: vi.fn().mockResolvedValue([customer({ id: 3, name: "360 Estate (Soban Raj)" })]) },
      sales: {
        nextBillNumber: vi.fn().mockResolvedValue(21),
        create: vi.fn().mockResolvedValue(cashBill),
        update: vi.fn().mockResolvedValue(cashBill),
        get: vi.fn().mockResolvedValue(cashBill),
        list: vi.fn().mockResolvedValue([{ ...cashBill, jobCount: 1, jobNames: ["700g UV Card"] }]),
      },
      invoices: { getBill: vi.fn().mockResolvedValue(billDocument({ ...cashBill })) },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("works out each line as qty x rate, the total and the balance after the advance", async () => {
    render(<CashSaleScreen />);
    await screen.findAllByRole("option", { name: /360 Estate/ });

    type("Line 1 description", "700g UV Card");
    type("Line 1 quantity", "1000");
    type("Line 1 rate", "13");
    fireEvent.click(screen.getByRole("button", { name: /add another line/i }));
    type("Line 2 description", "Envelopes");
    type("Line 2 quantity", "200");
    type("Line 2 rate", "15");
    type("Advance received now", "6500");

    expect(screen.getByTestId("line-1-amount")).toHaveTextContent("13,000");
    expect(screen.getByTestId("cash-total")).toHaveTextContent("Rs. 16,000.00");
    expect(screen.getByTestId("cash-balance")).toHaveTextContent("Rs. 9,500.00");
  });

  it("saves a cash sale with its online advance and opens the bill", async () => {
    render(<CashSaleScreen />);
    await screen.findAllByRole("option", { name: /360 Estate/ });

    fireEvent.change(screen.getByLabelText("Name", { selector: "#cash-customer" }), { target: { value: "3" } });
    type("Date", "2026-11-23");
    type("Line 1 description", "700g UV Card");
    type("Line 1 quantity", "1000");
    type("Line 1 rate", "13");
    type("Advance received now", "6500");
    fireEvent.click(screen.getByLabelText("Online"));
    type("Online detail", "JazzCash");
    fireEvent.click(screen.getByRole("button", { name: "Save cash sale" }));

    await waitFor(() =>
      expect(api.sales.create).toHaveBeenCalledWith({
        kind: "cash",
        customerId: 3,
        saleDate: "2026-11-23",
        notes: null,
        items: [{ description: "700g UV Card", qty: 1000, rateCents: 1_300 }],
        advanceCents: 650_000,
        advanceMethod: "online",
        advanceReference: "JazzCash",
      }),
    );
    expect(await screen.findByText(/Bill No. 21 saved/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Cash sale bill preview" })).toBeInTheDocument();
  });

  it("takes the whole total as advance with Paid in full", async () => {
    render(<CashSaleScreen />);
    await screen.findAllByRole("option", { name: /360 Estate/ });

    type("Line 1 description", "Card");
    type("Line 1 quantity", "10");
    type("Line 1 rate", "50");
    fireEvent.click(screen.getByRole("button", { name: "Paid in full" }));

    expect(screen.getByLabelText("Advance received now")).toHaveValue("500");
    expect(screen.getByTestId("cash-balance")).toHaveTextContent("Rs. 0.00");
  });

  it("asks for a description, quantity and rate on every line", async () => {
    render(<CashSaleScreen />);
    await screen.findAllByRole("option", { name: /360 Estate/ });

    fireEvent.change(screen.getByLabelText("Name", { selector: "#cash-customer" }), { target: { value: "3" } });
    type("Line 1 description", "Card");
    type("Line 1 rate", "13");
    fireEvent.click(screen.getByRole("button", { name: "Save cash sale" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("quantity must be more than zero");
    expect(api.sales.create).not.toHaveBeenCalled();
  });

  it("lists only cash sales and loads one back for editing", async () => {
    render(<CashSaleScreen />);

    expect(await screen.findByText("700g UV Card")).toBeInTheDocument();
    expect(api.sales.list).toHaveBeenCalledWith(expect.objectContaining({ kind: "cash" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    await waitFor(() => expect(screen.getByLabelText("Line 1 description")).toHaveValue("700g UV Card"));
    expect(screen.getByLabelText("Line 1 rate")).toHaveValue("13");
    expect(screen.getByLabelText("Advance received now")).toHaveValue("6500");
    expect(screen.getByLabelText("Online")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.sales.update).toHaveBeenCalledWith(9, expect.objectContaining({ kind: "cash", advanceCents: 650_000 }), ""));
  });
});
