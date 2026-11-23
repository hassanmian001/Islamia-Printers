// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BillPreview from "./BillPreview";
import { billDocument, createMockApi } from "@/test/mock-api";
import type { StyleCraftApi } from "@/types/stylecraft-api";

describe("BillPreview", () => {
  let api: StyleCraftApi;

  beforeEach(() => {
    window.localStorage.clear();
    api = createMockApi();
    window.stylecraft = api;
  });

  afterEach(() => {
    cleanup();
  });

  it("saves the whole bill-book page as an A5 PDF by default", async () => {
    render(<BillPreview bill={billDocument({ previousBalanceCents: 450_000, closingBalanceCents: 655_000 })} onClose={() => undefined} />);

    expect(screen.getByLabelText(/Poora bill/)).toBeChecked();
    expect(screen.getByTestId("bill-previous-balance")).toHaveTextContent("4,500/-");
    expect(screen.getByTestId("bill-balance")).toHaveTextContent("6,550/-");
    expect(screen.getByTitle("Bill No. 15 print preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(api.invoices.savePdf).toHaveBeenCalledTimes(1));
    const input = vi.mocked(api.invoices.savePdf).mock.calls[0][0];
    expect(input.pageSize).toBe("A5");
    expect(input.html).toContain('class="bg"');
  });

  it("prints only the details for a pre-printed pad, with an adjustment remembered on this PC", async () => {
    const { unmount } = render(<BillPreview bill={billDocument()} onClose={() => undefined} />);

    fireEvent.click(screen.getByLabelText(/Sirf detail/));
    fireEvent.change(screen.getByLabelText("Right / left (mm)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Down / up (mm)"), { target: { value: "-1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(api.invoices.savePdf).toHaveBeenCalledTimes(1));
    const input = vi.mocked(api.invoices.savePdf).mock.calls[0][0];
    expect(input.html).not.toContain('class="bg"');
    expect(input.html).toContain("transform:translate(2mm,-1.5mm)");
    expect(input.fileName).toBe("Bill 15 Islamia Press (details only)");

    unmount();
    render(<BillPreview bill={billDocument()} onClose={() => undefined} />);

    expect(screen.getByLabelText(/Sirf detail/)).toBeChecked();
    expect(screen.getByLabelText("Right / left (mm)")).toHaveValue(2);
  });
});
