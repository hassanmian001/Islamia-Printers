import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import BillPreview from "@/components/invoices/BillPreview";
import AdvanceFields, { advanceFromSale, emptyAdvance, readAdvance, type AdvanceForm } from "@/components/sales/AdvanceFields";
import BillHistory from "@/components/sales/BillHistory";
import { Button } from "@/components/ui/button";
import { compactInputClass, ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, formatAmountOrBlank, parseQuantity, parseRupeesToCents, toDayInputValue } from "@/lib/format";
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

  const [advance, setAdvance] = useState<AdvanceForm>(() => emptyAdvance());
  const [historyKey, setHistoryKey] = useState(0);
  const [bill, setBill] = useState<BillDocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomers(await window.stylecraft.contacts.listCustomers());
  }, []);

  const refreshNumbers = useCallback(async () => {
    setNextBillNumber(await window.stylecraft.sales.nextBillNumber());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([loadCustomers(), refreshNumbers()]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load sales.");
      }
    }

    void load();
  }, [loadCustomers, refreshNumbers]);

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
    setAdvance(emptyAdvance());
    setEditing(null);
    setCustomerId(null);
    setSaleDate(toDayInputValue());
  }

  function loadSaleIntoForm(sale: SaleDetailDto) {
    setCustomerId(sale.customerId);
    setSaleDate(toDayInputValue(sale.saleDate));
    setNotes(sale.notes ?? "");
    setAdvance(advanceFromSale(sale));
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

    const advanceCheck = readAdvance(advance, billTotalCents);

    if (advanceCheck.error) {
      setError(advanceCheck.error);
      return;
    }

    const input = {
      kind: "job" as const,
      customerId,
      saleDate,
      notes: notes || null,
      jobs: parsedJobs.map((job) => job.input),
      advanceCents: advanceCheck.cents,
      advanceMethod: advance.method,
      advanceReference: advance.method === "online" ? advance.reference || null : null,
    };
    setIsSaving(true);

    try {
      const saved = editing
        ? await window.stylecraft.sales.update(editing.sale.id, input, editing.password)
        : await window.stylecraft.sales.create(input);

      setMessage(editing ? `Bill No. ${saved.billNumber} updated.` : `Bill No. ${saved.billNumber} saved — ${formatCurrency(saved.totalAmountCents)} added to ${saved.customerName}'s khata.`);
      resetForm();
      setBill(null);
      setHistoryKey((key) => key + 1);
      await refreshNumbers();
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

  async function startEdit(saleId: number, password: string) {
    try {
      const detail = await window.stylecraft.sales.get(saleId);
      loadSaleIntoForm(detail);
      setEditing({ sale: detail, password });
      setMessage(null);
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open the bill.");
    }
  }

  async function handleDeleted(sale: SaleHistoryDto) {
    setMessage(`Bill No. ${sale.billNumber} deleted.`);

    if (bill?.id === sale.id) {
      setBill(null);
    }

    await refreshNumbers();
  }

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

        <AdvanceFields idPrefix="sale" onChange={setAdvance} totalCents={billTotalCents} value={advance} />

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

      <BillHistory
        customers={customers}
        kind="job"
        onDeleted={(sale) => void handleDeleted(sale)}
        onEdit={(saleId, password) => void startEdit(saleId, password)}
        onError={setError}
        onView={(saleId) => void openBill(saleId)}
        refreshKey={historyKey}
      />
    </div>
  );
}
