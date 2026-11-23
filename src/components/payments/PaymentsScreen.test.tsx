// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PaymentsScreen from "./PaymentsScreen";
import { createMockApi, customer } from "@/test/mock-api";
import type { PaymentListItemDto, StyleCraftApi } from "@/types/stylecraft-api";

const payments: PaymentListItemDto[] = [
  { id: 2, receiptNumber: 2, customerId: 1, customerName: "Islamia Press", amountCents: 400_000, paymentDate: new Date("2026-11-21T00:00:00"), method: "online", narration: "JazzCash TID 9", saleId: 7, billNumber: 15 },
  { id: 1, receiptNumber: 1, customerId: 1, customerName: "Islamia Press", amountCents: 600_000, paymentDate: new Date("2026-11-20T00:00:00"), method: "cash", narration: null, saleId: null, billNumber: null },
];

describe("PaymentsScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    api = createMockApi({
      contacts: { listCustomers: vi.fn().mockResolvedValue([customer()]) },
      ledger: {
        getSummary: vi.fn().mockResolvedValue({
          customers: [{ customerId: 1, customerName: "Islamia Press", phone: null, openingBalanceCents: 0, billedCents: 2_000_000, receivedCents: 1_000_000, balanceCents: 1_000_000, lastActivityDate: null }],
          totalReceivableCents: 1_000_000,
        }),
        nextReceiptNumber: vi.fn().mockResolvedValue(3),
        listPayments: vi.fn().mockResolvedValue(payments),
        recordPayment: vi.fn().mockResolvedValue({ id: 3, receiptNumber: 3, customerId: 1, amountCents: 250_000, paymentDate: new Date(), method: "online", narration: "Meezan", saleId: null }),
      },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("receives an online payment from a party and shows their balance first", async () => {
    render(<PaymentsScreen />);
    await screen.findAllByRole("option", { name: /Islamia Press/ });

    fireEvent.change(screen.getByLabelText("Party", { selector: "#receive-customer" }), { target: { value: "1" } });
    expect(screen.getByTestId("party-balance")).toHaveTextContent("Rs. 10,000.00");

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-23" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2500" } });
    fireEvent.click(screen.getByLabelText("Online"));
    fireEvent.change(screen.getByLabelText("Online detail"), { target: { value: "Meezan" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    await waitFor(() =>
      expect(api.ledger.recordPayment).toHaveBeenCalledWith({ customerId: 1, amountCents: 250_000, paymentDate: "2026-11-23", method: "online", narration: "Meezan" }),
    );
    expect(await screen.findByText(/Receipt 3 CR saved — Rs. 2,500.00 online from Islamia Press/)).toBeInTheDocument();
  });

  it("defaults to cash", async () => {
    render(<PaymentsScreen />);
    await screen.findAllByRole("option", { name: /Islamia Press/ });

    expect(screen.getByLabelText("Cash")).toBeChecked();
  });

  it("lists receipts with cash and online totals, and filters by method", async () => {
    render(<PaymentsScreen />);

    expect(await screen.findByText("Advance — Bill 15 · JazzCash TID 9")).toBeInTheDocument();
    expect(screen.getByTestId("payments-cash-total")).toHaveTextContent("Rs. 6,000.00");
    expect(screen.getByTestId("payments-online-total")).toHaveTextContent("Rs. 4,000.00");

    fireEvent.change(screen.getByLabelText("Cash / Online"), { target: { value: "online" } });

    await waitFor(() => expect(api.ledger.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ method: "online" })));
  });

  it("deletes a plain payment, but leaves a bill's advance to the bill", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PaymentsScreen />);

    const advanceRow = (await screen.findByText("2 CR")).closest("tr") as HTMLTableRowElement;
    expect(within(advanceRow).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(advanceRow).getByText("with bill")).toBeInTheDocument();

    const cashRow = screen.getByText("1 CR").closest("tr") as HTMLTableRowElement;
    fireEvent.click(within(cashRow).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(api.ledger.deletePayment).toHaveBeenCalledWith(1, ""));
  });
});
