import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import type { KhataRepairResultDto, PaidInFullSaleDto } from "@/types/stylecraft-api";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * Older versions saved a sale as paid in full whenever "Amount paid now" was
 * left blank, so udhaar sales never reached the khata. This panel lists those
 * sales and moves the chosen ones back onto the customer account.
 */
export default function PaidInFullRepairPanel({ onRepaired }: { onRepaired: () => void | Promise<void> }) {
  const [sales, setSales] = useState<PaidInFullSaleDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KhataRepairResultDto | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await window.stylecraft.ledger.listPaidInFullSales();
      setSales(rows);
      setSelectedIds(new Set(rows.filter((row) => row.customerId !== null).map((row) => row.saleId)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load the fully paid sales.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(saleId: number) {
    setIsConfirming(false);
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }

      return next;
    });
  }

  function selectAll(checked: boolean) {
    setIsConfirming(false);
    setSelectedIds(checked ? new Set(sales.filter((row) => row.customerId !== null).map((row) => row.saleId)) : new Set());
  }

  async function handleMove() {
    setError(null);
    setResult(null);
    setIsWorking(true);

    try {
      const moved = await window.stylecraft.ledger.moveSalesToKhata([...selectedIds]);
      setResult(moved);
      setIsConfirming(false);
      await load();
      await onRepaired();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not move the sales onto the khata.");
    } finally {
      setIsWorking(false);
    }
  }

  if (sales.length === 0) {
    return result === null ? null : (
      <section
        className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm text-emerald-800 dark:text-emerald-200"
        role="status"
      >
        {result.movedCount} sale{result.movedCount === 1 ? "" : "s"} worth {formatCurrency(result.movedAmountCents)} moved onto the khata. Nothing is left
        recorded as paid in full.
      </section>
    );
  }

  const selectedSales = sales.filter((row) => selectedIds.has(row.saleId));
  const selectedAmountCents = selectedSales.reduce((sum, row) => sum + row.amountPaidCents, 0);
  const withoutCustomer = sales.filter((row) => row.customerId === null);

  return (
    <section className="space-y-4 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950 dark:text-slate-50">Sales recorded as paid in full</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-200">
            {sales.length} sale{sales.length === 1 ? " is" : "s are"} saved with the full amount already received. Until this version, leaving &ldquo;Amount paid
            now&rdquo; blank saved a sale that way even when the customer paid nothing, so those balances never reached the khata. Tick the ones that were really
            udhaar and move them across.
          </p>
        </div>
        <Button className="border border-amber-400 dark:border-amber-700" onClick={() => setIsOpen((current) => !current)} size="sm" type="button" variant="ghost">
          {isOpen ? "Hide" : "Review"}
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
          role="status"
        >
          {result.movedCount} sale{result.movedCount === 1 ? "" : "s"} worth {formatCurrency(result.movedAmountCents)} moved onto the khata.
          {result.skippedSaleIds.length > 0 ? ` ${result.skippedSaleIds.length} could not be moved and were left alone.` : ""}
        </div>
      ) : null}

      {isOpen ? (
        <>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Take a backup first: Settings &rarr; Create manual backup. Moving a sale here deletes the payment that was saved with it and cannot be undone from
            inside the app.
          </p>

          <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/60">
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full divide-y divide-amber-200 dark:divide-amber-800/60 text-left text-sm">
                <thead className="sticky top-0 bg-amber-100 dark:bg-amber-900/40 text-xs uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        aria-label="Select every sale"
                        checked={selectedIds.size > 0 && selectedIds.size === sales.length - withoutCustomer.length}
                        onChange={(event) => selectAll(event.target.checked)}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-3 py-3 font-semibold">Invoice</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Payment method</th>
                    <th className="px-3 py-3 font-semibold">Recorded as paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40 bg-white dark:bg-slate-900">
                  {sales.map((row) => (
                    <tr key={row.saleId}>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Move ${row.invoiceNumber} onto the khata`}
                          checked={selectedIds.has(row.saleId)}
                          disabled={row.customerId === null}
                          onChange={() => toggle(row.saleId)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">{row.invoiceNumber}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.saleDate)}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {row.customerName ?? <span className="text-amber-700 dark:text-amber-400">No customer &mdash; edit the sale to add one first</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.paymentMethod ?? "-"}</td>
                      <td className="px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(row.amountPaidCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isConfirming ? (
              <>
                <Button className="bg-red-600 text-white hover:bg-red-700" disabled={isWorking} onClick={() => void handleMove()} type="button">
                  {isWorking ? "Moving..." : `Yes, move ${selectedSales.length} onto the khata`}
                </Button>
                <Button disabled={isWorking} onClick={() => setIsConfirming(false)} type="button" variant="ghost">
                  Cancel
                </Button>
              </>
            ) : (
              <Button disabled={selectedSales.length === 0 || isWorking} onClick={() => setIsConfirming(true)} type="button">
                Move {selectedSales.length} sale{selectedSales.length === 1 ? "" : "s"} onto the khata ({formatCurrency(selectedAmountCents)})
              </Button>
            )}
            {withoutCustomer.length > 0 ? (
              <span className="text-xs text-amber-800 dark:text-amber-300">
                {withoutCustomer.length} sale{withoutCustomer.length === 1 ? " has" : "s have"} no customer and cannot carry a balance.
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
