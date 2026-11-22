// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LedgerScreen from "./LedgerScreen";
import { billDocument, createMockApi, ledgerStatement } from "@/test/mock-api";
import type { StyleCraftApi } from "@/types/stylecraft-api";

describe("LedgerScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    api = createMockApi({
      ledger: {
        getSummary: vi.fn().mockResolvedValue({
          customers: [
            {
              customerId: 1,
              customerName: "Islamia Press",
              phone: "0300-6609031",
              openingBalanceCents: 20_909_100,
              billedCents: 205_000,
              receivedCents: 5_000_000,
              balanceCents: 16_114_100,
              lastActivityDate: new Date("2026-10-10T00:00:00"),
            },
            { customerId: 2, customerName: "Settled Co", phone: null, openingBalanceCents: 0, billedCents: 0, receivedCents: 0, balanceCents: 0, lastActivityDate: null },
          ],
          totalReceivableCents: 16_114_100,
        }),
        getStatement: vi.fn().mockResolvedValue(ledgerStatement()),
        nextReceiptNumber: vi.fn().mockResolvedValue(1004),
        recordPayment: vi.fn().mockResolvedValue({ id: 9, receiptNumber: 1004, customerId: 1, amountCents: 2_000_000, paymentDate: new Date(), narration: "cash" }),
      },
      invoices: { getBill: vi.fn().mockResolvedValue(billDocument()) },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the total receivable and hides settled accounts on request", async () => {
    render(<LedgerScreen />);

    expect(await screen.findByText("Islamia Press")).toBeInTheDocument();
    expect(screen.getAllByText("Rs. 161,141.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Settled Co")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show settled accounts"));

    expect(screen.queryByText("Settled Co")).not.toBeInTheDocument();
  });

  it("opens a khata like a statement of account: opening balance, job lines, sub-total, payments, grand total", async () => {
    render(<LedgerScreen />);

    fireEvent.click(await screen.findByText("Islamia Press"));

    const statement = await screen.findByRole("region", { name: "Statement of account preview" });
    expect(api.ledger.getStatement).toHaveBeenCalledWith(1, { startDate: null, endDate: null });
    expect(within(statement).getByText("Opening balance")).toBeInTheDocument();
    expect(within(statement).getByText("209,091")).toBeInTheDocument();
    expect(within(statement).getByText("15 SV")).toBeInTheDocument();
    expect(within(statement).getByText("Visiting cards")).toBeInTheDocument();
    expect(within(statement).getByText("1,000 × 2")).toBeInTheDocument();
    expect(within(statement).getByText(/Sub-Total/)).toBeInTheDocument();
    expect(within(statement).getByText("1003 CR")).toBeInTheDocument();
    expect(within(statement).getByText("mzn")).toBeInTheDocument();
    expect(within(statement).getByText("Grand Total")).toBeInTheDocument();
    expect(within(statement).getAllByText("161,141").length).toBeGreaterThan(0);
  });

  it("asks for a statement of just the chosen period", async () => {
    render(<LedgerScreen />);
    fireEvent.click(await screen.findByText("Islamia Press"));
    await screen.findByLabelText("From date");

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-11-16" } });

    await waitFor(() => expect(api.ledger.getStatement).toHaveBeenLastCalledWith(1, { startDate: "2026-10-01", endDate: "2026-11-16" }));
  });

  it("saves the statement as a landscape PDF", async () => {
    render(<LedgerScreen />);
    fireEvent.click(await screen.findByText("Islamia Press"));
    await screen.findByRole("region", { name: "Statement of account preview" });

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(api.invoices.savePdf).toHaveBeenCalledTimes(1));
    const input = vi.mocked(api.invoices.savePdf).mock.calls[0][0];
    expect(input.landscape).toBe(true);
    expect(input.fileName).toContain("Islamia Press");
    expect(input.html).toContain("Statement of Account");
  });

  it("records a payment received with its narration", async () => {
    render(<LedgerScreen />);
    fireEvent.click(await screen.findByText("Islamia Press"));
    await screen.findByText(/receipt 1004 CR/);

    fireEvent.change(screen.getByLabelText("Date", { selector: "#payment-date" }), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "20,000" } });
    fireEvent.change(screen.getByLabelText("Narration"), { target: { value: "mzn" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    await waitFor(() => expect(api.ledger.recordPayment).toHaveBeenCalledWith({ customerId: 1, amountCents: 2_000_000, paymentDate: "2026-11-20", narration: "mzn" }));
    expect(await screen.findByText(/Receipt 1004 CR saved/)).toBeInTheDocument();
  });

  it("opens the bill behind a khata line", async () => {
    render(<LedgerScreen />);
    fireEvent.click(await screen.findByText("Islamia Press"));
    await screen.findByRole("region", { name: "Statement of account preview" });

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByRole("region", { name: "Bill preview" })).toBeInTheDocument();
    expect(api.invoices.getBill).toHaveBeenCalledWith(7);
  });

  it("asks for the edit password before deleting a payment", async () => {
    api.security.getEditPasswordStatus = vi.fn().mockResolvedValue({ isSet: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<LedgerScreen />);
    fireEvent.click(await screen.findByText("Islamia Press"));
    await screen.findByRole("region", { name: "Statement of account preview" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.change(screen.getByLabelText(/Edit password needed to delete receipt 1003 CR/), { target: { value: "secret" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => expect(api.ledger.deletePayment).toHaveBeenCalledWith(3, "secret"));
  });
});
