import { useCallback, useEffect, useState } from "react";

import BillPreview from "@/components/invoices/BillPreview";
import DocumentPanel from "@/components/invoices/DocumentPanel";
import LedgerTable from "@/components/ledger/LedgerTable";
import PaymentMethodToggle from "@/components/payments/PaymentMethodToggle";
import { Button } from "@/components/ui/button";
import { ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { firstDayOfMonthInputValue, formatDate, parseRupeesToCents, toDayInputValue } from "@/lib/format";
import { buildLedgerHtml, ledgerDocumentFileName } from "@/lib/invoice-document";
import type { BillDocumentDto, LedgerStatementDto, LedgerSummaryDto, PaymentMethod } from "@/types/stylecraft-api";

export default function LedgerScreen() {
  const [summary, setSummary] = useState<LedgerSummaryDto | null>(null);
  const [search, setSearch] = useState("");
  const [showSettled, setShowSettled] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statement, setStatement] = useState<LedgerStatementDto | null>(null);
  const [bill, setBill] = useState<BillDocumentDto | null>(null);

  const [paymentDate, setPaymentDate] = useState(() => toDayInputValue());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNarration, setPaymentNarration] = useState("");
  const [nextReceiptNumber, setNextReceiptNumber] = useState<number | null>(null);

  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ paymentId: number; receiptNumber: number } | null>(null);
  const [pendingPassword, setPendingPassword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setSummary(await window.stylecraft.ledger.getSummary());
  }, []);

  const loadStatement = useCallback(async (customerId: number, from: string, to: string) => {
    setStatement(await window.stylecraft.ledger.getStatement(customerId, { startDate: from || null, endDate: to || null }));
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);

      try {
        await loadSummary();
        setNextReceiptNumber(await window.stylecraft.ledger.nextReceiptNumber());
        setIsPasswordSet((await window.stylecraft.security.getEditPasswordStatus()).isSet);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load the ledger.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [loadSummary]);

  useEffect(() => {
    if (selectedCustomerId === null) {
      setStatement(null);
      return;
    }

    loadStatement(selectedCustomerId, startDate, endDate).catch((caughtError: unknown) =>
      setError(caughtError instanceof Error ? caughtError.message : "Could not load the khata."),
    );
  }, [selectedCustomerId, startDate, endDate, loadStatement]);

  function openCustomer(customerId: number) {
    setError(null);
    setMessage(null);
    setBill(null);
    setSelectedCustomerId(customerId);
  }

  async function refreshAfterChange() {
    await loadSummary();
    setNextReceiptNumber(await window.stylecraft.ledger.nextReceiptNumber());

    if (selectedCustomerId !== null) {
      await loadStatement(selectedCustomerId, startDate, endDate);
    }
  }

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (selectedCustomerId === null) {
      return;
    }

    const amountCents = parseRupeesToCents(paymentAmount);

    if (amountCents === null || amountCents <= 0) {
      setError("Payment amount must be more than zero.");
      return;
    }

    setIsSaving(true);

    try {
      const payment = await window.stylecraft.ledger.recordPayment({
        customerId: selectedCustomerId,
        amountCents,
        paymentDate,
        method: paymentMethod,
        narration: paymentNarration || null,
      });

      setMessage(`Receipt ${payment.receiptNumber} CR saved — ${formatCurrency(payment.amountCents)} received (${paymentMethod}).`);
      setPaymentAmount("");
      setPaymentNarration("");
      await refreshAfterChange();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not record the payment.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeletePayment(paymentId: number, receiptNumber: number) {
    setError(null);
    setMessage(null);

    if (isPasswordSet) {
      setPendingDelete({ paymentId, receiptNumber });
      setPendingPassword("");
      return;
    }

    void deletePayment(paymentId, receiptNumber, "");
  }

  async function deletePayment(paymentId: number, receiptNumber: number, password: string) {
    if (!window.confirm(`Delete receipt ${receiptNumber} CR? The amount will go back onto the khata.`)) {
      return;
    }

    try {
      await window.stylecraft.ledger.deletePayment(paymentId, password);
      setPendingDelete(null);
      setMessage(`Receipt ${receiptNumber} CR deleted.`);
      await refreshAfterChange();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete the payment.");
    }
  }

  async function viewBill(saleId: number) {
    try {
      setBill(await window.stylecraft.invoices.getBill(saleId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open the bill.");
    }
  }

  const rows = summary?.customers ?? [];
  const term = search.trim().toLowerCase();
  const visibleRows = rows.filter(
    (row) => (showSettled || row.balanceCents !== 0) && (term === "" || row.customerName.toLowerCase().includes(term) || (row.phone ?? "").includes(term)),
  );

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Khata" title="Ledger">
        Every customer's statement of account: the opening balance, each bill job by job with a sub-total, and every payment received. Pick a date range to print
        a statement for just that period; everything before it is carried in as the opening balance.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
        <div className="text-sm text-slate-600 dark:text-slate-300">Total receivable (wusooli baqi)</div>
        <div className="text-2xl font-bold text-slate-950 dark:text-slate-50">{formatCurrency(summary?.totalReceivableCents ?? 0)}</div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className={`${labelClass} flex-1`} htmlFor="ledger-search">
          Search customer
          <input className={inputClass} id="ledger-search" onChange={(event) => setSearch(event.target.value)} placeholder="Name or phone" value={search} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
          <input checked={showSettled} onChange={(event) => setShowSettled(event.target.checked)} type="checkbox" />
          Show settled accounts
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 text-right font-semibold">Opening</th>
              <th className="px-4 py-3 text-right font-semibold">Billed</th>
              <th className="px-4 py-3 text-right font-semibold">Received</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 font-semibold">Last entry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {isLoading ? (
              <tr>
                <td className="px-4 py-5 text-slate-500 dark:text-slate-400" colSpan={6}>
                  Loading ledger...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-slate-500 dark:text-slate-400" colSpan={6}>
                  {rows.length === 0 ? "No customers yet. Add one from Customers or while making a bill." : "No matching accounts."}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selectedCustomerId === row.customerId ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                  key={row.customerId}
                  onClick={() => openCustomer(row.customerId)}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950 dark:text-slate-50">{row.customerName}</div>
                    {row.phone ? <div className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.openingBalanceCents === 0 ? "-" : formatCurrency(row.openingBalanceCents)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(row.billedCents)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(row.receivedCents)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.balanceCents > 0 ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-slate-50"}`}>
                    {formatCurrency(row.balanceCents)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.lastActivityDate ? formatDate(row.lastActivityDate) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {statement ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 md:flex-row md:items-end">
            <label className={labelClass} htmlFor="ledger-from">
              From date
              <input className={inputClass} id="ledger-from" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            </label>
            <label className={labelClass} htmlFor="ledger-to">
              To date
              <input className={inputClass} id="ledger-to" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setStartDate(firstDayOfMonthInputValue());
                  setEndDate(toDayInputValue());
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                This month
              </Button>
              <Button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                All dates
              </Button>
              <Button onClick={() => setSelectedCustomerId(null)} size="sm" type="button" variant="ghost">
                Close khata
              </Button>
            </div>
          </div>

          <DocumentPanel
            fileName={ledgerDocumentFileName(statement)}
            html={buildLedgerHtml(statement)}
            kicker="Statement of account"
            landscape
            onClose={() => setSelectedCustomerId(null)}
            subtitle={`A/C No. ${statement.customer.id}${statement.customer.phone ? ` · ${statement.customer.phone}` : ""} · Balance ${formatCurrency(statement.closingBalanceCents)}`}
            title={statement.customer.name}
          >
            <LedgerTable onDeletePayment={requestDeletePayment} onViewBill={(saleId) => void viewBill(saleId)} statement={statement} />
          </DocumentPanel>

          {bill ? <BillPreview bill={bill} onClose={() => setBill(null)} /> : null}

          {pendingDelete ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 md:flex-row md:items-end">
              <label className={`${labelClass} flex-1`} htmlFor="ledger-edit-password">
                Edit password needed to delete receipt {pendingDelete.receiptNumber} CR
                <input autoFocus className={inputClass} id="ledger-edit-password" onChange={(event) => setPendingPassword(event.target.value)} type="password" value={pendingPassword} />
              </label>
              <div className="flex gap-2">
                <Button onClick={() => void deletePayment(pendingDelete.paymentId, pendingDelete.receiptNumber, pendingPassword)} type="button">
                  Delete
                </Button>
                <Button onClick={() => setPendingDelete(null)} type="button" variant="ghost">
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <form className="grid gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4" noValidate onSubmit={handleRecordPayment}>
            <h4 className="font-semibold text-slate-950 dark:text-slate-50">
              Payment received from {statement.customer.name} {nextReceiptNumber !== null ? <span className="text-sm font-normal text-slate-500">(receipt {nextReceiptNumber} CR)</span> : null}
            </h4>
            <div className="grid gap-4 md:grid-cols-4">
              <label className={labelClass} htmlFor="payment-date">
                Date
                <input className={inputClass} id="payment-date" onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} />
              </label>
              <label className={labelClass} htmlFor="payment-amount">
                Amount
                <input className={inputClass} id="payment-amount" inputMode="decimal" onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0" value={paymentAmount} />
              </label>
              <PaymentMethodToggle name="ledger-payment-method" onChange={setPaymentMethod} value={paymentMethod} />
              <label className={labelClass} htmlFor="payment-narration">
                {paymentMethod === "online" ? "Online detail" : "Narration"}
                <input
                  className={inputClass}
                  id="payment-narration"
                  onChange={(event) => setPaymentNarration(event.target.value)}
                  placeholder={paymentMethod === "online" ? "JazzCash / Easypaisa / bank, TID" : "Optional, e.g. by hand, mzn"}
                  value={paymentNarration}
                />
              </label>
            </div>
            <div>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save payment"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
