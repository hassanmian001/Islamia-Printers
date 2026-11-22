// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContactsScreen from "./ContactsScreen";
import { createMockApi } from "@/test/mock-api";
import type { ContactsApi, ContactDto } from "@/types/stylecraft-api";

const sampleCustomers: ContactDto[] = [
  {
    id: 1,
    name: "Ali Khan",
    phone: "0300-0000000",
    email: "ali@example.com",
    address: "Lahore",
    notes: "Repeat buyer",
    openingBalanceCents: 25_000,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: 2,
    name: "Sara Ahmed",
    phone: null,
    email: "sara@example.com",
    address: null,
    notes: "Wholesale",
    openingBalanceCents: 0,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
];

describe("ContactsScreen", () => {
  let contactsApi: ContactsApi;

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    contactsApi = {
      listCustomers: vi.fn().mockResolvedValue(sampleCustomers),
      createCustomer: vi.fn().mockResolvedValue(sampleCustomers[0]),
      updateCustomer: vi.fn().mockResolvedValue(sampleCustomers[0]),
      deleteCustomer: vi.fn().mockResolvedValue(undefined),
    };

    window.stylecraft = createMockApi({ contacts: contactsApi });
  });

  it("lists customers only", async () => {
    render(<ContactsScreen />);

    expect(await screen.findByText("Ali Khan")).toBeInTheDocument();
    expect(screen.getByText("Sara Ahmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suppliers" })).not.toBeInTheDocument();
  });

  it("creates a customer with normalized optional fields", async () => {
    render(<ContactsScreen />);

    await screen.findByText("Ali Khan");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Hassan Printers  " } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: " 0321 " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: " Sialkot " } });
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));

    await waitFor(() => {
      expect(contactsApi.createCustomer).toHaveBeenCalledWith({
        name: "Hassan Printers",
        phone: "0321",
        email: null,
        address: "Sialkot",
        notes: null,
        openingBalanceCents: 0,
      });
    });
  });

  it("searches and edits a customer", async () => {
    render(<ContactsScreen />);

    await screen.findByText("Ali Khan");
    fireEvent.change(screen.getByLabelText("Search customers"), { target: { value: "wholesale" } });

    expect(screen.queryByText("Ali Khan")).not.toBeInTheDocument();
    const row = screen.getByText("Sara Ahmed").closest("tr");
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sara Ahmed Printers" } });
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));

    await waitFor(() => {
      expect(contactsApi.updateCustomer).toHaveBeenCalledWith(2, expect.objectContaining({ name: "Sara Ahmed Printers", email: "sara@example.com" }));
    });
  });

  it("deletes a customer after confirming, and shows why when it cannot", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ContactsScreen />);

    const row = (await screen.findByText("Sara Ahmed")).closest("tr");
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(contactsApi.deleteCustomer).toHaveBeenCalledWith(2));

    vi.mocked(window.stylecraft.contacts.deleteCustomer).mockRejectedValueOnce(new Error("This customer has bills or payments on their khata, so they cannot be deleted."));
    const aliRow = screen.getByText("Ali Khan").closest("tr");
    fireEvent.click(within(aliRow as HTMLTableRowElement).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be deleted");
  });

  it("carries an old khata balance in as an opening balance", async () => {
    render(<ContactsScreen />);

    await screen.findByText("Ali Khan");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nadeem Stationers" } });
    fireEvent.change(screen.getByLabelText(/^Opening balance/), { target: { value: "1250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));

    await waitFor(() => {
      expect(contactsApi.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ name: "Nadeem Stationers", openingBalanceCents: 125_050 }));
    });
  });

  it("shows the opening balance a customer was carried in with, ready to edit", async () => {
    render(<ContactsScreen />);

    const row = (await screen.findByText("Ali Khan")).closest("tr");
    expect(within(row as HTMLTableRowElement).getByText("Rs. 250.00")).toBeInTheDocument();

    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/^Opening balance/)).toHaveValue(250);
  });
});
