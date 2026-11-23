import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import type { ContactDto, ContactInput } from "@/types/stylecraft-api";

type ContactFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  openingBalance: string;
};

function decimalStringToCents(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return Number.NaN;
  }

  return Math.round(amount * 100);
}

function makeEmptyForm(): ContactFormState {
  return {
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    openingBalance: "",
  };
}

function toFormState(contact: ContactDto): ContactFormState {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    notes: contact.notes ?? "",
    openingBalance: contact.openingBalanceCents === 0 ? "" : (contact.openingBalanceCents / 100).toFixed(2),
  };
}

function buildContactInput(form: ContactFormState): { input?: ContactInput; error?: string } {
  const name = form.name.trim();

  if (!name) {
    return { error: "Customer name is required." };
  }

  const openingBalanceCents = form.openingBalance.trim() ? decimalStringToCents(form.openingBalance) : 0;

  if (!Number.isInteger(openingBalanceCents)) {
    return { error: "Opening balance must be an amount." };
  }

  return {
    input: {
      name,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      openingBalanceCents,
    },
  };
}

function matchesSearch(contact: ContactDto, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [contact.name, contact.phone, contact.email, contact.address, contact.notes].some((value) =>
    (value ?? "").toLowerCase().includes(normalizedSearch),
  );
}

export default function ContactsScreen() {
  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [form, setForm] = useState<ContactFormState>(() => makeEmptyForm());
  const [editingContact, setEditingContact] = useState<ContactDto | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadContacts() {
    setIsLoading(true);
    setError(null);

    try {
      setCustomers(await window.stylecraft.contacts.listCustomers());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load customers.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContacts();
  }, []);

  function resetForm() {
    setForm(makeEmptyForm());
    setEditingContact(null);
  }

  function startEditing(contact: ContactDto) {
    setEditingContact(contact);
    setForm(toFormState(contact));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const { input, error: validationError } = buildContactInput(form);

    if (!input) {
      setError(validationError ?? "Contact details are incomplete.");
      return;
    }

    try {
      if (editingContact) {
        await window.stylecraft.contacts.updateCustomer(editingContact.id, input);
      } else {
        await window.stylecraft.contacts.createCustomer(input);
      }

      resetForm();
      await loadContacts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save customer.");
    }
  }

  async function handleDelete(contact: ContactDto) {
    setError(null);

    if (!window.confirm(`Delete ${contact.name}? This only works for a customer with no bills or payments.`)) {
      return;
    }

    try {
      await window.stylecraft.contacts.deleteCustomer(contact.id);

      if (editingContact?.id === contact.id) {
        resetForm();
      }

      await loadContacts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete customer.");
    }
  }

  const filteredContacts = customers.filter((contact) => matchesSearch(contact, search));
  const activeLabel = "Customer";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">Khata accounts</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">Customers</h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Every customer has their own khata. Old udhaar from before this software goes in as the opening balance.
          </p>
        </div>
        <div className="rounded-2xl bg-brand-50 dark:bg-brand-950/40 px-4 py-3 text-sm text-brand-700">
          <span className="font-semibold">{customers.length}</span> customers
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">
          {error}
        </div>
      ) : null}

      <form className="grid gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-slate-50">{editingContact ? `Edit ${activeLabel.toLowerCase()}` : `Add ${activeLabel.toLowerCase()}`}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Name is required. Other details are optional.</p>
          </div>
          {editingContact ? (
            <Button onClick={resetForm} type="button" variant="ghost">
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-name">
            Name
            <input
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="contact-name"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-phone">
            Phone
            <input
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="contact-phone"
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              value={form.phone}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-email">
            Email
            <input
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="contact-email"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              value={form.email}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-address">
            Address
            <input
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="contact-address"
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              value={form.address}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-opening-balance">
            Opening balance
            <input
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="contact-opening-balance"
              onChange={(event) => setForm((current) => ({ ...current, openingBalance: event.target.value }))}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={form.openingBalance}
            />
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Old udhaar this customer already owed before this software. Use a minus figure for money paid in advance.
            </span>
          </label>
        </div>

        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-notes">
          Notes
          <textarea
            className="min-h-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            id="contact-notes"
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            value={form.notes}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isLoading} type="submit">
            {editingContact ? `Save ${activeLabel.toLowerCase()}` : `Add ${activeLabel.toLowerCase()}`}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="contact-search">
          Search customers
          <input
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            id="contact-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone, email, address, or notes"
            value={search}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
          <h3 className="font-semibold text-slate-950 dark:text-slate-50">Customer directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Opening</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500 dark:text-slate-400" colSpan={7}>
                    Loading customers...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500 dark:text-slate-400" colSpan={7}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-4 font-medium text-slate-950 dark:text-slate-50">{contact.name}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{contact.phone ?? "-"}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{contact.email ?? "-"}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{contact.address ?? "-"}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {contact.openingBalanceCents === 0 ? "-" : formatCurrency(contact.openingBalanceCents)}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{contact.notes ?? "-"}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        <Button onClick={() => startEditing(contact)} type="button" variant="ghost">
                          Edit
                        </Button>
                        <Button onClick={() => void handleDelete(contact)} type="button" variant="ghost">
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
