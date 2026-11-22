import { useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/form";
import type { ContactDto } from "@/types/stylecraft-api";

type CustomerPickerProps = {
  id: string;
  customers: ContactDto[];
  value: number | null;
  onChange: (customerId: number | null) => void;
  /** Called after a new customer is added from here, so the caller can reload its list. */
  onCustomerCreated?: (customer: ContactDto) => void;
  label?: string;
  allowAll?: boolean;
};

/** A customer dropdown with a quick "add new" for someone walking in for the first time. */
export default function CustomerPicker({ id, customers, value, onChange, onCustomerCreated, label = "Customer", allowAll = false }: CustomerPickerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleAdd() {
    setError(null);

    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const customer = await window.stylecraft.contacts.createCustomer({ name, phone: phone || null });
      onCustomerCreated?.(customer);
      onChange(customer.id);
      setName("");
      setPhone("");
      setIsAdding(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not add the customer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className={labelClass} htmlFor={id}>
        {label}
        <div className="flex gap-2">
          <select
            className={`${inputClass} min-w-0 flex-1`}
            id={id}
            onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
            value={value ?? ""}
          >
            <option value="">{allowAll ? "All customers" : "Select a customer"}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.phone ? ` — ${customer.phone}` : ""}
              </option>
            ))}
          </select>
          {onCustomerCreated ? (
            <Button onClick={() => setIsAdding((current) => !current)} size="sm" type="button" variant="ghost">
              {isAdding ? "Cancel" : "+ New"}
            </Button>
          ) : null}
        </div>
      </label>

      {isAdding ? (
        <div className="grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 md:grid-cols-[1fr_1fr_auto]">
          <input aria-label="New customer name" className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="Customer name" value={name} />
          <input aria-label="New customer phone" className={inputClass} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" value={phone} />
          <Button disabled={isSaving} onClick={() => void handleAdd()} type="button">
            Add customer
          </Button>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400 md:col-span-3" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
