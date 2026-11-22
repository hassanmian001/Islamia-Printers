// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReportsScreen, { buildSalesCsv } from "./ReportsScreen";
import { charge, createMockApi, customer } from "@/test/mock-api";
import type { ReportsDto, StyleCraftApi } from "@/types/stylecraft-api";

const none = charge(0, 0);

const report: ReportsDto = {
  filters: {},
  rows: [
    {
      saleId: 1,
      billNumber: 15,
      saleDate: new Date("2026-11-01T00:00:00"),
      customerName: "Islamia Press",
      jobName: "Visiting cards",
      rota: charge(1000, 200),
      gto: none,
      cutting: charge(1, 5_000),
      lamination: none,
      dye: none,
      totalAmountCents: 205_000,
    },
    {
      saleId: 2,
      billNumber: 16,
      saleDate: new Date("2026-11-05T00:00:00"),
      customerName: "Al Noor, Sons",
      jobName: "Boxes",
      rota: none,
      gto: none,
      cutting: none,
      lamination: charge(100, 200),
      dye: charge(3, 25_000),
      totalAmountCents: 95_000,
    },
  ],
  workTotals: { rota: 200_000, gto: 0, cutting: 5_000, lamination: 20_000, dye: 75_000 },
  salesTotalCents: 300_000,
  billCount: 2,
  jobCount: 2,
  receivedCents: 100_000,
};

describe("ReportsScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    api = createMockApi({
      reports: { getReports: vi.fn().mockResolvedValue(report) },
      contacts: { listCustomers: vi.fn().mockResolvedValue([customer()]) },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows every job sold with totals per kind of work", async () => {
    render(<ReportsScreen />);

    expect(await screen.findByText("Visiting cards")).toBeInTheDocument();
    expect(screen.getByText("Boxes")).toBeInTheDocument();
    expect(screen.getByText("Rs. 3,000.00")).toBeInTheDocument();
    expect(screen.getByText("2 bills · 2 jobs")).toBeInTheDocument();
    expect(screen.getByTestId("work-total-rota")).toHaveTextContent("Rs. 2,000.00");
    expect(screen.getByTestId("work-total-dye")).toHaveTextContent("Rs. 750.00");
  });

  it("reloads for a new date range", async () => {
    render(<ReportsScreen />);
    await screen.findByText("Visiting cards");

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });

    await waitFor(() => expect(api.reports.getReports).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-10-01" })));
  });

  it("exports one CSV line per job with qty, rate and amount for each kind of work", () => {
    const lines = buildSalesCsv(report).split("\n");

    expect(lines[0]).toBe(
      "Date,Bill No,Customer,Job name,Rota P qty,Rota P rate,Rota P amount,GTO P qty,GTO P rate,GTO P amount,Cutting qty,Cutting rate,Cutting amount,Lamination qty,Lamination rate,Lamination amount,Dye qty,Dye rate,Dye amount,Grand Total",
    );
    expect(lines[1]).toBe("01/11/2026,15,Islamia Press,Visiting cards,1000,2.00,2000.00,0,0.00,0.00,1,50.00,50.00,0,0.00,0.00,0,0.00,0.00,2050.00");
    expect(lines[2]).toContain('"Al Noor, Sons"');
    expect(lines[3]).toBe(",,,Total,,,2000.00,,,0.00,,,50.00,,,200.00,,,750.00,3000.00");
  });
});
