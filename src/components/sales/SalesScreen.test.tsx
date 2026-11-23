// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SalesScreen from "./SalesScreen";
import { billDocument, createMockApi, customer, saleDetail, saleJob, charge } from "@/test/mock-api";
import type { SaleHistoryDto, StyleCraftApi } from "@/types/stylecraft-api";

function historyRow(overrides: Partial<SaleHistoryDto> = {}): SaleHistoryDto {
  const { jobs, ...detail } = saleDetail();

  return { ...detail, jobCount: jobs.length, jobNames: jobs.map((job) => job.jobName), ...overrides };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("SalesScreen", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    api = createMockApi({
      contacts: { listCustomers: vi.fn().mockResolvedValue([customer(), customer({ id: 2, name: "Al Noor", phone: null })]) },
      sales: {
        nextBillNumber: vi.fn().mockResolvedValue(16),
        list: vi.fn().mockResolvedValue([historyRow()]),
        create: vi.fn().mockResolvedValue(saleDetail({ id: 8, billNumber: 16 })),
        update: vi.fn().mockResolvedValue(saleDetail()),
        get: vi.fn().mockResolvedValue(saleDetail({ jobs: [saleJob({ jobName: "Letterhead", gto: charge(2.5, 120_000), rota: charge(0, 0), cutting: charge(0, 0) })] })),
      },
      invoices: { getBill: vi.fn().mockResolvedValue(billDocument({ id: 8, billNumber: 16 })) },
    });
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("works out each job as quantity x rate and adds up the bill as you type", async () => {
    render(<SalesScreen />);
    await screen.findByText("16");

    type("Job 1 name", "Visiting cards");
    type("Job 1 Rota P quantity", "2000");
    type("Job 1 Rota P rate", "1.5");
    type("Job 1 Cutting rate", "500"); // no quantity: a flat charge counts as 1

    expect(screen.getByTestId("job-1-total")).toHaveTextContent("3,500");

    fireEvent.click(screen.getByRole("button", { name: /add another job/i }));
    type("Job 2 name", "Letterhead");
    type("Job 2 GTO P quantity", "2.5");
    type("Job 2 GTO P rate", "1200");

    expect(screen.getByTestId("job-2-total")).toHaveTextContent("3,000");
    expect(screen.getByTestId("bill-total")).toHaveTextContent("6,500.00");
  });

  it("saves the bill for the chosen customer and opens it for printing", async () => {
    render(<SalesScreen />);
    await screen.findAllByRole("option", { name: /Al Noor/ });

    fireEvent.change(screen.getByLabelText("Customer", { selector: "#sale-customer" }), { target: { value: "2" } });
    type("Date", "2026-11-20");
    type("Job 1 name", "Boxes");
    type("Job 1 Dye quantity", "3");
    type("Job 1 Dye rate", "250");
    type("Job 1 Lamination quantity", "100");
    type("Job 1 Lamination rate", "2");
    fireEvent.click(screen.getByRole("button", { name: "Save bill" }));

    await waitFor(() => expect(api.sales.create).toHaveBeenCalledTimes(1));
    expect(api.sales.create).toHaveBeenCalledWith({
      kind: "job",
      advanceCents: 0,
      advanceMethod: "cash",
      advanceReference: null,
      customerId: 2,
      saleDate: "2026-11-20",
      notes: null,
      jobs: [
        {
          jobName: "Boxes",
          rota: { qty: 0, rateCents: 0 },
          gto: { qty: 0, rateCents: 0 },
          cutting: { qty: 0, rateCents: 0 },
          lamination: { qty: 100, rateCents: 200 },
          dye: { qty: 3, rateCents: 25_000 },
        },
      ],
    });
    expect(await screen.findByText(/Bill No. 16 saved/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Bill preview" })).toBeInTheDocument();
  });

  it("asks for the customer before saving", async () => {
    render(<SalesScreen />);
    await screen.findByText("16");

    type("Job 1 name", "Cards");
    type("Job 1 Rota P rate", "100");
    fireEvent.click(screen.getByRole("button", { name: "Save bill" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Select the customer");
    expect(api.sales.create).not.toHaveBeenCalled();
  });

  it("refuses a rate that is not a number", async () => {
    render(<SalesScreen />);
    await screen.findAllByRole("option", { name: /Al Noor/ });

    fireEvent.change(screen.getByLabelText("Customer", { selector: "#sale-customer" }), { target: { value: "1" } });
    type("Job 1 name", "Cards");
    type("Job 1 Rota P rate", "abc");
    fireEvent.click(screen.getByRole("button", { name: "Save bill" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Rota P rate is not a valid amount");
    expect(api.sales.create).not.toHaveBeenCalled();
  });

  it("asks for the edit password, loads the bill and saves the change with it", async () => {
    api.security.getEditPasswordStatus = vi.fn().mockResolvedValue({ isSet: true });
    render(<SalesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Edit password needed to edit Bill No. 15/), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByLabelText("Job 1 name")).toHaveValue("Letterhead"));
    expect(api.security.verifyEditPassword).toHaveBeenCalledWith("1234");
    expect(screen.getByLabelText("Job 1 GTO P quantity")).toHaveValue("2.5");
    expect(screen.getByLabelText("Job 1 GTO P rate")).toHaveValue("1200");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.sales.update).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.sales.update).mock.calls[0][0]).toBe(7);
    expect(vi.mocked(api.sales.update).mock.calls[0][2]).toBe("1234");
  });

  it("lists bill history and deletes a bill after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SalesScreen />);

    expect(await screen.findByText("Visiting cards")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(api.sales.delete).toHaveBeenCalledWith(7, ""));
    expect(await screen.findByText("Bill No. 15 deleted.")).toBeInTheDocument();
  });

  it("takes an advance online and shows what is left as balance", async () => {
    render(<SalesScreen />);
    await screen.findAllByRole("option", { name: /Al Noor/ });

    fireEvent.change(screen.getByLabelText("Customer", { selector: "#sale-customer" }), { target: { value: "1" } });
    type("Job 1 name", "Cards");
    type("Job 1 Rota P quantity", "1000");
    type("Job 1 Rota P rate", "2");
    type("Advance received now", "500");
    fireEvent.click(screen.getByLabelText("Online"));
    type("Online detail", "JazzCash TID 77");

    expect(screen.getByTestId("sale-balance")).toHaveTextContent("Rs. 1,500.00");

    fireEvent.click(screen.getByRole("button", { name: "Save bill" }));

    await waitFor(() => expect(api.sales.create).toHaveBeenCalledTimes(1));
    expect(api.sales.create).toHaveBeenCalledWith(expect.objectContaining({ kind: "job", advanceCents: 50_000, advanceMethod: "online", advanceReference: "JazzCash TID 77" }));
  });

  it("refuses an advance larger than the bill", async () => {
    render(<SalesScreen />);
    await screen.findAllByRole("option", { name: /Al Noor/ });

    fireEvent.change(screen.getByLabelText("Customer", { selector: "#sale-customer" }), { target: { value: "1" } });
    type("Job 1 name", "Cards");
    type("Job 1 Rota P rate", "100");
    type("Advance received now", "101");
    fireEvent.click(screen.getByRole("button", { name: "Save bill" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Advance cannot be more than the bill total.");
    expect(api.sales.create).not.toHaveBeenCalled();
  });

  it("lists only job bills in its history", async () => {
    render(<SalesScreen />);

    await screen.findByText("Visiting cards");

    expect(api.sales.list).toHaveBeenCalledWith(expect.objectContaining({ kind: "job" }));
  });
});
