import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import BillPreview from "@/components/invoices/BillPreview";
import AdvanceFields, { advanceFromSale, emptyAdvance, readAdvance, type AdvanceForm } from "@/components/sales/AdvanceFields";
import BillHistory from "@/components/sales/BillHistory";
import { Button } from "@/components/ui/button";
import { compactInputClass, ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, parseQuantity, parseRupeesToCents, toDayInputValue } from "@/lib/format";
import { workAmountCents } from "@/lib/job-math";
import type { BillDocumentDto, CashSaleItemInput, ContactDto, SaleDetailDto, SaleHistoryDto } from "@/types/stylecraft-api";

type LineForm = { key: number; description: string; qty: string; rate: string };

type ParsedLine = { input: CashSaleItemInput; amountCents: number; error: string | null };

function parseLine(line: LineForm, index: number): ParsedLine {
  const label = line.description.trim() ? `"${line.description.trim()}"` : `Line ${index + 1}`;
  const qty = parseQuantity(line.qty);
  const rateCents = parseRupeesToCents(line.rate);
  let error: string | null = null;

  if (!line.description.trim()) {
    error = `Line ${index + 1} needs a description.`;
  } else if (qty === null || qty <= 0) {
    error = `${label}: quantity must be more than zero.`;
  } else if (rateCents === null || rateCents <= 0) {
    error = `${label}: rate must be more than zero.`;
  }

  const safeQty = qty !== null && qty > 0 ? qty : 0;
  const safeRate = rateCents !== null && rateCents > 0 ? rateCents : 0;

  return {
    input: { description: line.description.trim(), qty: safeQty, rateCents: safeRate },
    amountCents: workAmountCents({ qty: safeQty, rateCents: safeRate }),
    error,
  };
}

/**
 * A counter sale written like the shop's bill book: Description, Qty, Rate,
 * Amount, then Total, the advance taken (cash or online) and the balance. The
 * bill and the advance both go on the customer's khata.
 */
export default function CashSaleScreen() {
  const nextKey = useRef(1);
  const makeLine = useCallback((): LineForm => {
    const key = nextKey.current;
    nextKey.current += 1;
    return { key, description: "", qty: "", rate: "" };
  }, []);

  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState(() => toDayInputValue());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>(() => [makeLine()]);
  const [advance, setAdvance] = useState<AdvanceForm>(() => emptyAdvance());
  const [nextBillNumber, setNextBillNumber] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ sale: SaleDetailDto; password: string } | null>(null);
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
    Promise.all([loadCustomers(), refreshNumbers()]).catch((caughtError: unknown) =>
      setError(caughtError instanceof Error ? caughtError.message : "Could not load cash sales."),
    );
  }, [loadCustomers, refreshNumbers]);

  const parsedLines = useMemo(() => lines.map((line, index) => parseLine(line, index)), [lines]);
  const totalCents = parsedLines.reduce((sum, line) => sum + line.amountCents, 0);

  function updateLine(key: number, field: keyof Omit<LineForm, "key">, value: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function resetForm() {
    setLines([makeLine()]);
    setNotes("");
    setAdvance(emptyAdvance());
    setEditing(null);
    setCustomerId(null);
    setSaleDate(toDayInputValue());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (customerId === null) {
      setError("Select the customer this bill is for.");
      return;
    }

    const lineError = parsedLines.find((line) => line.error !== null)?.error;

    if (lineError) {
      setError(lineError);
      return;
    }

    const advanceCheck = readAdvance(advance, totalCents);

    if (advanceCheck.error) {
      setError(advanceCheck.error);
      return;
    }

    const input = {
      kind: "cash" as const,
      customerId,
      saleDate,
      notes: notes || null,
      items: parsedLines.map((line) => line.input),
      advanceCents: advanceCheck.cents,
      advanceMethod: advance.method,
      advanceReference: advance.method === "online" ? advance.reference || null : null,
    };
    setIsSaving(true);

    try {
      const saved = editing ? await window.stylecraft.sales.update(editing.sale.id, input, editing.password) : await window.stylecraft.sales.create(input);

      setMessage(
        editing
          ? `Bill No. ${saved.billNumber} updated.`
          : `Bill No. ${saved.billNumber} saved — total ${formatCurrency(saved.totalAmountCents)}, advance ${formatCurrency(saved.advanceCents)}, balance ${formatCurrency(saved.balanceCents)} on ${saved.customerName}'s khata.`,
      );
      resetForm();
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
      const sale = await window.stylecraft.sales.get(saleId);
      setCustomerId(sale.customerId);
      setSaleDate(toDayInputValue(sale.saleDate));
      setNotes(sale.notes ?? "");
      setAdvance(advanceFromSale(sale));
      setLines(
        sale.items.map((item) => ({ ...makeLine(), description: item.description, qty: String(item.qty), rate: String(item.rateCents / 100) })),
      );
      setEditing({ sale, password });
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
      <ScreenHeader kicker="Cash Sale" title={editing ? `Edit Bill No. ${editing.sale.billNumber}` : "New cash sale"}>
        Write the bill as in the bill book: description, quantity and rate. Take the advance in cash or online; the bill and the advance both go on the
        customer's khata, and whatever is left stays as their balance.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <form className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-[140px_180px_1fr]">
          <div className={labelClass}>
            Sr. / Bill No.
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 font-semibold text-slate-950 dark:text-slate-50">
              {editing ? editing.sale.billNumber : (nextBillNumber ?? "-")}
            </div>
          </div>
          <label className={labelClass} htmlFor="cash-date">
            Date
            <input className={inputClass} id="cash-date" onChange={(event) => setSaleDate(event.target.value)} type="date" value={saleDate} />
          </label>
          <CustomerPicker customers={customers} id="cash-customer" label="Name" onChange={setCustomerId} onCustomerCreated={() => void loadCustomers()} value={customerId} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-[#991F36] text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="w-8 px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th className="w-28 px-2 py-2 text-center font-semibold">Qty.</th>
                <th className="w-28 px-2 py-2 text-center font-semibold">Rate</th>
                <th className="w-32 px-2 py-2 text-right font-semibold">Amount</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{index + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Line ${index + 1} description`}
                      className={`${compactInputClass} text-left`}
                      onChange={(event) => updateLine(line.key, "description", event.target.value)}
                      placeholder="e.g. 700g UV Round Corner Matt Card (500x2)"
                      value={line.description}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Line ${index + 1} quantity`}
                      className={compactInputClass}
                      inputMode="decimal"
                      onChange={(event) => updateLine(line.key, "qty", event.target.value)}
                      placeholder="Qty"
                      value={line.qty}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Line ${index + 1} rate`}
                      className={compactInputClass}
                      inputMode="decimal"
                      onChange={(event) => updateLine(line.key, "rate", event.target.value)}
                      placeholder="Rate"
                      value={line.rate}
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-950 dark:text-slate-50" data-testid={`line-${index + 1}-amount`}>
                    {formatAmount(parsedLines[index].amountCents)}
                  </td>
                  <td className="px-1 py-2">
                    <Button
                      aria-label={`Remove line ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button className="gap-2" onClick={() => setLines((current) => [...current, makeLine()])} type="button" variant="ghost">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another line
        </Button>

        <AdvanceFields idPrefix="cash" onChange={setAdvance} totalCents={totalCents} value={advance} />

        <label className={labelClass} htmlFor="cash-notes">
          Notes
          <input className={inputClass} id="cash-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Optional" value={notes} />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save changes" : "Save cash sale"}
          </Button>
          <Button onClick={resetForm} type="button" variant="ghost">
            {editing ? "Cancel edit" : "Clear"}
          </Button>
        </div>
      </form>

      {bill ? <BillPreview bill={bill} onClose={() => setBill(null)} /> : null}

      <BillHistory
        customers={customers}
        kind="cash"
        onDeleted={(sale) => void handleDeleted(sale)}
        onEdit={(saleId, password) => void startEdit(saleId, password)}
        onError={setError}
        onView={(saleId) => void openBill(saleId)}
        refreshKey={historyKey}
      />
    </div>
  );
}
