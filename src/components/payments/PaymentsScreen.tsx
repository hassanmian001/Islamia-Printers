import { useCallback, useEffect, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import PaymentMethodToggle from "@/components/payments/PaymentMethodToggle";
import { Button } from "@/components/ui/button";
import { ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatDate, parseRupeesToCents, toDayInputValue } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/invoice-document";
import type { ContactDto, LedgerCustomerSummaryDto, PaymentListItemDto, PaymentMethod } from "@/types/stylecraft-api";

/**
 * Money received from a party, in cash or online. Each receipt gets its own
 * number and goes straight onto the customer's khata as a credit.
 */
export default function PaymentsScreen() {
  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [balances, setBalances] = useState<Map<number, LedgerCustomerSummaryDto>>(new Map());
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => toDayInputValue());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null);

  const [payments, setPayments] = useState<PaymentListItemDto[]>([]);
  const [filterCustomerId, setFilterCustomerId] = useState<number | null>(null);
  const [filterMethod, setFilterMethod] = useState<PaymentMethod | "">("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentListItemDto | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadParties = useCallback(async () => {
    const [list, summary] = await Promise.all([window.stylecraft.contacts.listCustomers(), window.stylecraft.ledger.getSummary()]);
    setCustomers(list);
    setBalances(new Map(summary.customers.map((row) => [row.customerId, row])));
  }, []);

  const loadPayments = useCallback(async () => {
    setPayments(
      await window.stylecraft.ledger.listPayments({
        customerId: filterCustomerId,
        method: filterMethod || null,
        startDate: filterStart || null,
        endDate: filterEnd || null,
      }),
    );
  }, [filterCustomerId, filterMethod, filterStart, filterEnd]);

  useEffect(() => {
    async function load() {
      try {
        await loadParties();
        setNextReceiptNumber(await window.stylecraft.ledger.nextReceiptNumber());
        setIsPasswordSet((await window.stylecraft.security.getEditPasswordStatus()).isSet);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load payments.");
      }
    }

    void load();
  }, [loadParties]);

  useEffect(() => {
    loadPayments().catch((caughtError: unknown) => setError(caughtError instanceof Error ? caughtError.message : "Could not load payments."));
  }, [loadPayments]);

  async function refresh() {
    await Promise.all([loadParties(), loadPayments()]);
    setNextReceiptNumber(await window.stylecraft.ledger.nextReceiptNumber());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (customerId === null) {
      setError("Select who the payment is from.");
      return;
    }

    const amountCents = parseRupeesToCents(amount);

    if (amountCents === null || amountCents <= 0) {
      setError("Payment amount must be more than zero.");
      return;
    }

    setIsSaving(true);

    try {
      const payment = await window.stylecraft.ledger.recordPayment({ customerId, amountCents, paymentDate, method, narration: reference || null });
      const name = customers.find((customer) => customer.id === customerId)?.name ?? "the customer";

      setMessage(`Receipt ${payment.receiptNumber} CR saved — ${formatCurrency(payment.amountCents)} ${paymentMethodLabel(payment.method).toLowerCase()} from ${name}.`);
      setAmount("");
      setReference("");
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the payment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePayment(payment: PaymentListItemDto, typedPassword: string) {
    if (!window.confirm(`Delete receipt ${payment.receiptNumber} CR (${formatCurrency(payment.amountCents)} from ${payment.customerName})? The amount goes back onto the khata.`)) {
      return;
    }

    try {
      await window.stylecraft.ledger.deletePayment(payment.id, typedPassword);
      setPendingDelete(null);
      setMessage(`Receipt ${payment.receiptNumber} CR deleted.`);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete the payment.");
    }
  }

  function requestDelete(payment: PaymentListItemDto) {
    setError(null);
    setMessage(null);

    if (isPasswordSet) {
      setPendingDelete(payment);
      setPassword("");
      return;
    }

    void deletePayment(payment, "");
  }

  const selectedBalance = customerId === null ? null : (balances.get(customerId)?.balanceCents ?? 0);
  const cashCents = payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amountCents, 0);
  const onlineCents = payments.filter((payment) => payment.method === "online").reduce((sum, payment) => sum + payment.amountCents, 0);

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Payment Received" title="Receive payment">
        Money a party pays you, in cash or online. It is credited to their khata straight away with its own receipt number.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <form className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-[140px_180px_1fr]">
          <div className={labelClass}>
            Receipt No.
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 font-semibold text-slate-950 dark:text-slate-50">
              {nextReceiptNumber ?? "-"} CR
            </div>
          </div>
          <label className={labelClass} htmlFor="receive-date">
            Date
            <input className={inputClass} id="receive-date" onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} />
          </label>
          <div className="grid gap-1">
            <CustomerPicker customers={customers} id="receive-customer" label="Party" onChange={setCustomerId} onCustomerCreated={() => void loadParties()} value={customerId} />
            {selectedBalance !== null ? (
              <p className="text-sm text-slate-600 dark:text-slate-300" data-testid="party-balance">
                Balance on khata: <span className={`font-semibold ${selectedBalance > 0 ? "text-brand-700 dark:text-brand-300" : ""}`}>{formatCurrency(selectedBalance)}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className={labelClass} htmlFor="receive-amount">
            Amount
            <input className={inputClass} id="receive-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0" value={amount} />
          </label>
          <PaymentMethodToggle name="receive-method" onChange={setMethod} value={method} />
          <label className={labelClass} htmlFor="receive-reference">
            {method === "online" ? "Online detail" : "Narration"}
            <input
              className={inputClass}
              id="receive-reference"
              onChange={(event) => setReference(event.target.value)}
              placeholder={method === "online" ? "JazzCash / Easypaisa / bank, TID" : "Optional, e.g. by hand, mzn"}
              value={reference}
            />
          </label>
        </div>

        <Button disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save payment"}
        </Button>
      </form>

      {pendingDelete ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 md:flex-row md:items-end">
          <label className={`${labelClass} flex-1`} htmlFor="receive-edit-password">
            Edit password needed to delete receipt {pendingDelete.receiptNumber} CR
            <input autoFocus className={inputClass} id="receive-edit-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void deletePayment(pendingDelete, password)} type="button">
              Delete
            </Button>
            <Button onClick={() => setPendingDelete(null)} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Payments received</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cash <span className="font-semibold" data-testid="payments-cash-total">{formatCurrency(cashCents)}</span> · Online{" "}
            <span className="font-semibold" data-testid="payments-online-total">{formatCurrency(onlineCents)}</span> · Total{" "}
            <span className="font-semibold">{formatCurrency(cashCents + onlineCents)}</span>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <CustomerPicker allowAll customers={customers} id="payments-filter-customer" label="Party" onChange={setFilterCustomerId} value={filterCustomerId} />
          <label className={labelClass} htmlFor="payments-filter-method">
            Cash / Online
            <select className={inputClass} id="payments-filter-method" onChange={(event) => setFilterMethod(event.target.value as PaymentMethod | "")} value={filterMethod}>
              <option value="">Both</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className={labelClass} htmlFor="payments-filter-start">
            From
            <input className={inputClass} id="payments-filter-start" onChange={(event) => setFilterStart(event.target.value)} type="date" value={filterStart} />
          </label>
          <label className={labelClass} htmlFor="payments-filter-end">
            To
            <input className={inputClass} id="payments-filter-end" onChange={(event) => setFilterEnd(event.target.value)} type="date" value={filterEnd} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 font-semibold">Receipt</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Party</th>
                <th className="px-3 py-3 font-semibold">Cash / Online</th>
                <th className="px-3 py-3 font-semibold">Detail</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {payments.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-slate-500 dark:text-slate-400" colSpan={7}>
                    No payments yet.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">{payment.receiptNumber} CR</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(payment.paymentDate)}</td>
                    <td className="px-3 py-3 text-slate-950 dark:text-slate-50">{payment.customerName}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          payment.method === "online" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        }`}
                      >
                        {paymentMethodLabel(payment.method)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {[payment.billNumber !== null ? `Advance — Bill ${payment.billNumber}` : null, payment.narration].filter(Boolean).join(" · ") || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(payment.amountCents)}</td>
                    <td className="px-3 py-3 text-right">
                      {payment.billNumber === null ? (
                        <Button onClick={() => requestDelete(payment)} size="sm" type="button" variant="ghost">
                          Delete
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400" title="Edit the bill to change its advance">
                          with bill
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
