// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardScreen from "./DashboardScreen";
import { createMockApi } from "@/test/mock-api";

describe("DashboardScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows sales, receipts, receivables and the month's work by kind", async () => {
    window.stylecraft = createMockApi({
      dashboard: {
        getSummary: vi.fn().mockResolvedValue({
          todaySalesCents: 350_000,
          todayBillCount: 2,
          monthSalesCents: 7_750_000,
          monthBillCount: 31,
          monthReceivedCents: 5_000_000,
          totalReceivableCents: 71_301_500,
          customerCount: 12,
          monthWorkTotals: { rota: 4_000_000, gto: 2_000_000, cutting: 500_000, lamination: 750_000, dye: 500_000 },
          topReceivables: [{ customerId: 1, customerName: "Islamia Press", phone: "0300-6609031", balanceCents: 71_301_500 }],
        }),
      },
    });

    render(<DashboardScreen />);

    expect(await screen.findByText("Rs. 3,500.00")).toBeInTheDocument();
    expect(screen.getByText("2 bills today")).toBeInTheDocument();
    expect(screen.getByText("Rs. 77,500.00")).toBeInTheDocument();
    expect(screen.getByText("Rs. 50,000.00")).toBeInTheDocument();
    expect(screen.getAllByText("Rs. 713,015.00")).toHaveLength(2);
    expect(screen.getByText("Rota P")).toBeInTheDocument();
    expect(screen.getByText("Rs. 40,000.00")).toBeInTheDocument();
    expect(screen.getByText("Islamia Press")).toBeInTheDocument();
    expect(screen.queryByText(/stock/i)).not.toBeInTheDocument();
  });

  it("shows the error when the summary cannot be loaded", async () => {
    window.stylecraft = createMockApi({ dashboard: { getSummary: vi.fn().mockRejectedValue(new Error("Database is locked")) } });

    render(<DashboardScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Database is locked");
  });
});
