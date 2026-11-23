import { useCallback, useEffect, useRef, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import type { ContactDto, SaleHistoryDto, SaleKind } from "@/types/stylecraft-api";

type BillHistoryProps = {
  kind: SaleKind;
  customers: ContactDto[];
  /** Bump to reload, e.g. after a bill is saved. */
  refreshKey: number;
  onView: (saleId: number) => void;
  /** The password has already been checked when this is called. */
  onEdit: (saleId: number, password: string) => void;
  onDeleted: (sale: SaleHistoryDto) => void;
  onError: (message: string) => void;
};

/** Past bills of one kind, with filters, and View / Edit / Delete behind the edit password. */
export default function BillHistory({ kind, customers, refreshKey, onView, onEdit, onDeleted, onError }: BillHistoryProps) {
  const [history, setHistory] = useState<SaleHistoryDto[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [pending, setPending] = useState<{ action: "edit" | "delete"; sale: SaleHistoryDto } | null>(null);
  const [password, setPassword] = useState("");
  const idPrefix = `${kind}-history`;
  // Held in a ref so a parent passing a fresh callback each render does not reload the list.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(async () => {
    setHistory(await window.stylecraft.sales.list({ kind, customerId, startDate: startDate || null, endDate: endDate || null, search: search || null }));
  }, [kind, customerId, startDate, endDate, search]);

  useEffect(() => {
    load().catch((caughtError: unknown) => onErrorRef.current(caughtError instanceof Error ? caughtError.message : "Could not load bills."));
  }, [load, refreshKey]);

  useEffect(() => {
    window.stylecraft.security
      .getEditPasswordStatus()
      .then((status) => setIsPasswordSet(status.isSet))
      .catch(() => setIsPasswordSet(false));
  }, []);

  async function run(action: "edit" | "delete", sale: SaleHistoryDto, typedPassword: string) {
    try {
      if (isPasswordSet && !(await window.stylecraft.security.verifyEditPassword(typedPassword))) {
        onError("Edit password is not correct.");
        return;
      }

      setPending(null);

      if (action === "edit") {
        onEdit(sale.id, typedPassword);
        return;
      }

      if (!window.confirm(`Delete Bill No. ${sale.billNumber} (${sale.customerName}, ${formatCurrency(sale.totalAmountCents)})? It and its advance will be removed from the khata.`)) {
        return;
      }

      await window.stylecraft.sales.delete(sale.id, typedPassword);
      onDeleted(sale);
      await load();
    } catch (caughtError) {
      onError(caughtError instanceof Error ? caughtError.message : "Could not complete that.");
    }
  }

  function request(action: "edit" | "delete", sale: SaleHistoryDto) {
    if (isPasswordSet) {
      setPending({ action, sale });
      setPassword("");
      return;
    }

    void run(action, sale, "");
  }

  const totalCents = history.reduce((sum, sale) => sum + sale.totalAmountCents, 0);
  const balanceCents = history.reduce((sum, sale) => sum + sale.balanceCents, 0);

  return (
    <section className="space-y-3">
      {pending ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 md:flex-row md:items-end">
          <label className={`${labelClass} flex-1`} htmlFor={`${idPrefix}-password`}>
            Edit password needed to {pending.action} Bill No. {pending.sale.billNumber}
            <input autoFocus className={inputClass} id={`${idPrefix}-password`} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void run(pending.action, pending.sale, password)} type="button">
              Continue
            </Button>
            <Button onClick={() => setPending(null)} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">{kind === "cash" ? "Cash sale history" : "Bill history"}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {history.length} bills · {formatCurrency(totalCents)} · balance {formatCurrency(balanceCents)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <CustomerPicker allowAll customers={customers} id={`${idPrefix}-customer`} label="Customer" onChange={setCustomerId} value={customerId} />
        <label className={labelClass} htmlFor={`${idPrefix}-start`}>
          From
          <input className={inputClass} id={`${idPrefix}-start`} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className={labelClass} htmlFor={`${idPrefix}-end`}>
          To
          <input className={inputClass} id={`${idPrefix}-end`} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
        <label className={labelClass} htmlFor={`${idPrefix}-search`}>
          Search
          <input className={inputClass} id={`${idPrefix}-search`} onChange={(event) => setSearch(event.target.value)} placeholder="Bill no., customer or item" value={search} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-3 font-semibold">Bill No.</th>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Customer</th>
              <th className="px-3 py-3 font-semibold">{kind === "cash" ? "Items" : "Jobs"}</th>
              <th className="px-3 py-3 text-right font-semibold">Total</th>
              <th className="px-3 py-3 text-right font-semibold">Adv.</th>
              <th className="px-3 py-3 text-right font-semibold">Bal.</th>
              <th className="px-3 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {history.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-slate-500 dark:text-slate-400" colSpan={8}>
                  No bills yet.
                </td>
              </tr>
            ) : (
              history.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">{sale.billNumber}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(sale.saleDate)}</td>
                  <td className="px-3 py-3 text-slate-950 dark:text-slate-50">{sale.customerName}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{sale.jobNames.join(", ")}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(sale.totalAmountCents)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                    {sale.advanceCents === 0 ? "-" : formatCurrency(sale.advanceCents)}
                    {sale.advanceCents > 0 && sale.advanceMethod === "online" ? <div className="text-[11px] text-slate-500">Online</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-slate-950 dark:text-slate-50">{formatCurrency(sale.balanceCents)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => onView(sale.id)} size="sm" type="button" variant="ghost">
                        View / Print
                      </Button>
                      <Button onClick={() => request("edit", sale)} size="sm" type="button" variant="ghost">
                        Edit
                      </Button>
                      <Button onClick={() => request("delete", sale)} size="sm" type="button" variant="ghost">
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
    </section>
  );
}
