import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import BillPreview from "@/components/invoices/BillPreview";
import { Button } from "@/components/ui/button";
import { compactInputClass, ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, formatAmountOrBlank, formatDate, parseQuantity, parseRupeesToCents, toDayInputValue } from "@/lib/format";
import { workAmountCents, workKinds, workLabels, type WorkKind } from "@/lib/job-math";
import type { BillDocumentDto, ContactDto, SaleDetailDto, SaleHistoryDto, SaleJobInput } from "@/types/stylecraft-api";

type WorkForm = { qty: string; rate: string };
type JobForm = { key: number; jobName: string } & Record<WorkKind, WorkForm>;

type ParsedJob = {
  input: SaleJobInput;
  amounts: Record<WorkKind, number>;
  totalCents: number;
  error: string | null;
};

function emptyWork(): WorkForm {
  return { qty: "", rate: "" };
}

function trimNumber(value: number) {
  return value === 0 ? "" : String(value);
}

/**
 * Reads one job row. A rate typed with the quantity left empty counts as a
 * quantity of 1, so a flat charge (cutting Rs 500) needs only the rate.
 */
function parseJob(job: JobForm, index: number): ParsedJob {
  const label = job.jobName.trim() ? `"${job.jobName.trim()}"` : `Job ${index + 1}`;
  let error: string | null = null;
  const charges = {} as SaleJobInput;
  const amounts = {} as Record<WorkKind, number>;

  for (const kind of workKinds) {
    const rateCents = parseRupeesToCents(job[kind].rate);
    let qty = parseQuantity(job[kind].qty);

    if (rateCents === null || rateCents < 0) {
      error ??= `${label}: ${workLabels[kind]} rate is not a valid amount.`;
    }

    if (qty === null || qty < 0) {
      error ??= `${label}: ${workLabels[kind]} quantity is not a valid number.`;
    }

    const safeRate = rateCents !== null && rateCents > 0 ? rateCents : 0;
    qty = qty !== null && qty > 0 ? qty : 0;

    if (qty === 0 && safeRate > 0 && job[kind].qty.trim() === "") {
      qty = 1;
    }

    charges[kind] = { qty, rateCents: safeRate };
    amounts[kind] = workAmountCents({ qty, rateCents: safeRate });
  }

  const totalCents = workKinds.reduce((sum, kind) => sum + amounts[kind], 0);

  return { input: { ...charges, jobName: job.jobName.trim() }, amounts, totalCents, error };
}

export default function SalesScreen() {
  const nextKey = useRef(1);
  const makeJob = useCallback((): JobForm => {
    const key = nextKey.current;
    nextKey.current += 1;

    return { key, jobName: "", rota: emptyWork(), gto: emptyWork(), cutting: emptyWork(), lamination: emptyWork(), dye: emptyWork() };
  }, []);

  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState(() => toDayInputValue());
  const [notes, setNotes] = useState("");
  const [jobs, setJobs] = useState<JobForm[]>(() => [makeJob()]);
  const [nextBillNumber, setNextBillNumber] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ sale: SaleDetailDto; password: string } | null>(null);

  const [history, setHistory] = useState<SaleHistoryDto[]>([]);
  const [filterCustomerId, setFilterCustomerId] = useState<number | null>(null);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [search, setSearch] = useState("");

  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [pending, setPending] = useState<{ kind: "edit" | "delete"; sale: SaleHistoryDto } | null>(null);
  const [pendingPassword, setPendingPassword] = useState("");

  const [bill, setBill] = useState<BillDocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomers(await window.stylecraft.contacts.listCustomers());
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(
      await window.stylecraft.sales.list({
        customerId: filterCustomerId,
        startDate: filterStart || null,
        endDate: filterEnd || null,
        search: search || null,
      }),
    );
  }, [filterCustomerId, filterStart, filterEnd, search]);

  const refreshNumbers = useCallback(async () => {
    setNextBillNumber(await window.stylecraft.sales.nextBillNumber());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([loadCustomers(), refreshNumbers()]);
        setIsPasswordSet((await window.stylecraft.security.getEditPasswordStatus()).isSet);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load sales.");
      }
    }

    void load();
  }, [loadCustomers, refreshNumbers]);

  useEffect(() => {
    loadHistory().catch((caughtError: unknown) => setError(caughtError instanceof Error ? caughtError.message : "Could not load bills."));
  }, [loadHistory]);

  const parsedJobs = useMemo(() => jobs.map((job, index) => parseJob(job, index)), [jobs]);
  const billTotalCents = parsedJobs.reduce((sum, job) => sum + job.totalCents, 0);

  function updateJob(key: number, change: (job: JobForm) => JobForm) {
    setJobs((current) => current.map((job) => (job.key === key ? change(job) : job)));
  }

  function updateWork(key: number, kind: WorkKind, field: keyof WorkForm, value: string) {
    updateJob(key, (job) => ({ ...job, [kind]: { ...job[kind], [field]: value } }));
  }

  function resetForm() {
    setJobs([makeJob()]);
    setNotes("");
    setEditing(null);
    setCustomerId(null);
    setSaleDate(toDayInputValue());
  }

  function loadSaleIntoForm(sale: SaleDetailDto) {
    setCustomerId(sale.customerId);
    setSaleDate(toDayInputValue(sale.saleDate));
    setNotes(sale.notes ?? "");
    setJobs(
      sale.jobs.map((job) => {
        const form = makeJob();
        form.jobName = job.jobName;

        for (const kind of workKinds) {
          form[kind] = { qty: trimNumber(job[kind].qty), rate: job[kind].rateCents === 0 ? "" : String(job[kind].rateCents / 100) };
        }

        return form;
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (customerId === null) {
      setError("Select the customer this bill is for.");
      return;
    }

    const firstError = parsedJobs.find((job) => job.error !== null)?.error;

    if (firstError) {
      setError(firstError);
      return;
    }

    const input = { customerId, saleDate, notes: notes || null, jobs: parsedJobs.map((job) => job.input) };
    setIsSaving(true);

    try {
      const saved = editing
        ? await window.stylecraft.sales.update(editing.sale.id, input, editing.password)
        : await window.stylecraft.sales.create(input);

      setMessage(editing ? `Bill No. ${saved.billNumber} updated.` : `Bill No. ${saved.billNumber} saved — ${formatCurrency(saved.totalAmountCents)} added to ${saved.customerName}'s khata.`);
      resetForm();
      setBill(null);
      await Promise.all([loadHistory(), refreshNumbers()]);
      setBill(await window.stylecraft.invoices.getBill(saved.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the bill.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openBill(saleId: number) {
    setError(null);

    try {
      setBill(await window.stylecraft.invoices.getBill(saleId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open the bill.");
    }
  }

  async function startEdit(sale: SaleHistoryDto, password: string) {
    const detail = await window.stylecraft.sales.get(sale.id);
    loadSaleIntoForm(detail);
    setEditing({ sale: detail, password });
    setMessage(null);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  async function requestAction(kind: "edit" | "delete", sale: SaleHistoryDto) {
    setError(null);
    setMessage(null);

    if (isPasswordSet) {
      setPending({ kind, sale });
      setPendingPassword("");
      return;
    }

    await runAction(kind, sale, "");
  }

  async function runAction(kind: "edit" | "delete", sale: SaleHistoryDto, password: string) {
    try {
      if (isPasswordSet && !(await window.stylecraft.security.verifyEditPassword(password))) {
        setError("Edit password is not correct.");
        return;
      }

      setPending(null);

      if (kind === "edit") {
        await startEdit(sale, password);
        return;
      }

      if (!window.confirm(`Delete Bill No. ${sale.billNumber} (${sale.customerName}, ${formatCurrency(sale.totalAmountCents)})? It will be removed from the khata.`)) {
        return;
      }

      await window.stylecraft.sales.delete(sale.id, password);
      setMessage(`Bill No. ${sale.billNumber} deleted.`);

      if (bill?.id === sale.id) {
        setBill(null);
      }

      await Promise.all([loadHistory(), refreshNumbers()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not complete that.");
    }
  }

  const historyTotalCents = history.reduce((sum, sale) => sum + sale.totalAmountCents, 0);

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Sales" title={editing ? `Edit Bill No. ${editing.sale.billNumber}` : "New bill"}>
        Enter each job on its own line. Every kind of work is quantity × rate; leave the quantity empty for a flat charge and it counts as 1. The bill total goes
        straight onto the customer's khata.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <form className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-[140px_180px_1fr]">
          <div className={labelClass}>
            Bill No.
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 font-semibold text-slate-950 dark:text-slate-50">
              {editing ? editing.sale.billNumber : (nextBillNumber ?? "-")}
            </div>
          </div>
          <label className={labelClass} htmlFor="sale-date">
            Date
            <input className={inputClass} id="sale-date" onChange={(event) => setSaleDate(event.target.value)} type="date" value={saleDate} />
          </label>
          <CustomerPicker
            customers={customers}
            id="sale-customer"
            onChange={setCustomerId}
            onCustomerCreated={() => void loadCustomers()}
            value={customerId}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="w-8 px-2 py-2 text-left font-semibold">#</th>
                <th className="min-w-[170px] px-2 py-2 text-left font-semibold">Job name</th>
                {workKinds.map((kind) => (
                  <th className="w-[92px] px-1 py-2 text-center font-semibold" key={kind}>
                    {workLabels[kind]}
                    <div className="text-[10px] font-normal normal-case tracking-normal">qty / rate</div>
                  </th>
                ))}
                <th className="w-[100px] px-2 py-2 text-right font-semibold">Grand Total</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((job, index) => {
                const parsed = parsedJobs[index];

                return (
                  <tr key={job.key}>
                    <td className="px-2 py-2 align-top text-slate-500 dark:text-slate-400">{index + 1}</td>
                    <td className="px-2 py-2 align-top">
                      <input
                        aria-label={`Job ${index + 1} name`}
                        className={`${compactInputClass} text-left`}
                        onChange={(event) => updateJob(job.key, (current) => ({ ...current, jobName: event.target.value }))}
                        placeholder="e.g. Visiting cards"
                        value={job.jobName}
                      />
                    </td>
                    {workKinds.map((kind) => (
                      <td className="px-1 py-2 align-top" key={kind}>
                        <div className="grid gap-1">
                          <input
                            aria-label={`Job ${index + 1} ${workLabels[kind]} quantity`}
                            className={compactInputClass}
                            inputMode="decimal"
                            onChange={(event) => updateWork(job.key, kind, "qty", event.target.value)}
                            placeholder="Qty"
                            value={job[kind].qty}
                          />
                          <input
                            aria-label={`Job ${index + 1} ${workLabels[kind]} rate`}
                            className={compactInputClass}
                            inputMode="decimal"
                            onChange={(event) => updateWork(job.key, kind, "rate", event.target.value)}
                            placeholder="Rate"
                            value={job[kind].rate}
                          />
                          <div className="min-h-4 text-right text-xs text-slate-500 dark:text-slate-400">{formatAmountOrBlank(parsed.amounts[kind])}</div>
                        </div>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right align-top font-semibold text-slate-950 dark:text-slate-50" data-testid={`job-${index + 1}-total`}>
                      {formatAmount(parsed.totalCents)}
                    </td>
                    <td className="px-1 py-2 align-top">
                      <Button
                        aria-label={`Remove job ${index + 1}`}
                        disabled={jobs.length === 1}
                        onClick={() => setJobs((current) => current.filter((entry) => entry.key !== job.key))}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <Button className="gap-2" onClick={() => setJobs((current) => [...current, makeJob()])} type="button" variant="ghost">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another job
          </Button>
          <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-3 text-right">
            <div className="text-sm text-slate-500 dark:text-slate-400">Bill total</div>
            <div className="text-2xl font-bold text-slate-950 dark:text-slate-50" data-testid="bill-total">
              {formatCurrency(billTotalCents)}
            </div>
          </div>
        </div>

        <label className={labelClass} htmlFor="sale-notes">
          Notes
          <input className={inputClass} id="sale-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Optional" value={notes} />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save changes" : "Save bill"}
          </Button>
          <Button onClick={resetForm} type="button" variant="ghost">
            {editing ? "Cancel edit" : "Clear"}
          </Button>
        </div>
      </form>

      {bill ? <BillPreview bill={bill} onClose={() => setBill(null)} /> : null}

      {pending ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 md:flex-row md:items-end">
          <label className={`${labelClass} flex-1`} htmlFor="sale-edit-password">
            Edit password needed to {pending.kind} Bill No. {pending.sale.billNumber}
            <input
              autoFocus
              className={inputClass}
              id="sale-edit-password"
              onChange={(event) => setPendingPassword(event.target.value)}
              type="password"
              value={pendingPassword}
            />
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void runAction(pending.kind, pending.sale, pendingPassword)} type="button">
              Continue
            </Button>
            <Button onClick={() => setPending(null)} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Bill history</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {history.length} bills · {formatCurrency(historyTotalCents)}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <CustomerPicker allowAll customers={customers} id="sale-filter-customer" label="Customer" onChange={setFilterCustomerId} value={filterCustomerId} />
          <label className={labelClass} htmlFor="sale-filter-start">
            From
            <input className={inputClass} id="sale-filter-start" onChange={(event) => setFilterStart(event.target.value)} type="date" value={filterStart} />
          </label>
          <label className={labelClass} htmlFor="sale-filter-end">
            To
            <input className={inputClass} id="sale-filter-end" onChange={(event) => setFilterEnd(event.target.value)} type="date" value={filterEnd} />
          </label>
          <label className={labelClass} htmlFor="sale-filter-search">
            Search
            <input className={inputClass} id="sale-filter-search" onChange={(event) => setSearch(event.target.value)} placeholder="Bill no., customer or job" value={search} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 font-semibold">Bill No.</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Jobs</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-slate-500 dark:text-slate-400" colSpan={6}>
                    No bills yet.
                  </td>
                </tr>
              ) : (
                history.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">{sale.billNumber}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(sale.saleDate)}</td>
                    <td className="px-3 py-3 text-slate-950 dark:text-slate-50">{sale.customerName}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{sale.jobNames.join(", ")}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(sale.totalAmountCents)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button onClick={() => void openBill(sale.id)} size="sm" type="button" variant="ghost">
                          View / Print
                        </Button>
                        <Button onClick={() => void requestAction("edit", sale)} size="sm" type="button" variant="ghost">
                          Edit
                        </Button>
                        <Button onClick={() => void requestAction("delete", sale)} size="sm" type="button" variant="ghost">
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
    </div>
  );
}
