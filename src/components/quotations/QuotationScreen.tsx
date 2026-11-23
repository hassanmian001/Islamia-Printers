import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import BillPreview from "@/components/invoices/BillPreview";
import QuotationPreview from "@/components/quotations/QuotationPreview";
import AdvanceFields, { emptyAdvance, readAdvance, type AdvanceForm } from "@/components/sales/AdvanceFields";
import ItemLinesEditor, { parseLine, type LineForm } from "@/components/sales/ItemLinesEditor";
import { Button } from "@/components/ui/button";
import { ErrorBanner, inputClass, labelClass, ScreenHeader, SuccessBanner } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { formatDate, toDayInputValue } from "@/lib/format";
import type { BillDocumentDto, ContactDto, QuotationDetailDto, QuotationHistoryDto } from "@/types/stylecraft-api";

type PartyMode = "customer" | "typed";

/**
 * Prices quoted before the work: description / qty / rate lines for a saved
 * customer or a name typed in. Nothing goes on the khata until the party
 * agrees and the quotation is turned into a cash sale bill.
 */
export default function QuotationScreen() {
  const nextKey = useRef(1);
  const makeLine = useCallback((): LineForm => {
    const key = nextKey.current;
    nextKey.current += 1;
    return { key, description: "", qty: "", rate: "" };
  }, []);

  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [partyMode, setPartyMode] = useState<PartyMode>("customer");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [quotationDate, setQuotationDate] = useState(() => toDayInputValue());
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>(() => [makeLine()]);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [editing, setEditing] = useState<QuotationDetailDto | null>(null);

  const [history, setHistory] = useState<QuotationHistoryDto[]>([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [converting, setConverting] = useState<QuotationDetailDto | null>(null);
  const [convertDate, setConvertDate] = useState(() => toDayInputValue());
  const [advance, setAdvance] = useState<AdvanceForm>(() => emptyAdvance());

  const [preview, setPreview] = useState<QuotationDetailDto | null>(null);
  const [bill, setBill] = useState<BillDocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomers(await window.stylecraft.contacts.listCustomers());
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(await window.stylecraft.quotations.list({ search: search || null, startDate: startDate || null, endDate: endDate || null }));
  }, [search, startDate, endDate]);

  const refreshNumber = useCallback(async () => {
    setNextNumber(await window.stylecraft.quotations.nextNumber());
  }, []);

  useEffect(() => {
    Promise.all([loadCustomers(), refreshNumber()]).catch((caughtError: unknown) =>
      setError(caughtError instanceof Error ? caughtError.message : "Could not load quotations."),
    );
  }, [loadCustomers, refreshNumber]);

  useEffect(() => {
    loadHistory().catch((caughtError: unknown) => setError(caughtError instanceof Error ? caughtError.message : "Could not load quotations."));
  }, [loadHistory]);

  const parsedLines = useMemo(() => lines.map((line, index) => parseLine(line, index)), [lines]);
  const totalCents = parsedLines.reduce((sum, line) => sum + line.amountCents, 0);

  function updateLine(key: number, field: keyof Omit<LineForm, "key">, value: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function resetForm() {
    setLines([makeLine()]);
    setNotes("");
    setEditing(null);
    setCustomerId(null);
    setPartyName("");
    setPartyPhone("");
    setValidUntil("");
    setQuotationDate(toDayInputValue());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (partyMode === "customer" && customerId === null) {
      setError("Select the customer, or switch to typing a name.");
      return;
    }

    if (partyMode === "typed" && !partyName.trim()) {
      setError("Type the party's name.");
      return;
    }

    const lineError = parsedLines.find((line) => line.error !== null)?.error;

    if (lineError) {
      setError(lineError);
      return;
    }

    const input = {
      customerId: partyMode === "customer" ? customerId : null,
      customerName: partyMode === "typed" ? partyName : null,
      customerPhone: partyMode === "typed" ? partyPhone || null : null,
      quotationDate,
      validUntil: validUntil || null,
      notes: notes || null,
      items: parsedLines.map((line) => line.input),
    };
    setIsSaving(true);

    try {
      const saved = editing ? await window.stylecraft.quotations.update(editing.id, input) : await window.stylecraft.quotations.create(input);

      setMessage(`Quotation Q-${saved.quotationNumber} ${editing ? "updated" : "saved"} — ${formatCurrency(saved.totalAmountCents)} for ${saved.customerName}.`);
      resetForm();
      setBill(null);
      setPreview(saved);
      await Promise.all([loadHistory(), refreshNumber()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the quotation.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openQuotation(id: number, then: (quotation: QuotationDetailDto) => void) {
    setError(null);
    setMessage(null);

    try {
      then(await window.stylecraft.quotations.get(id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open the quotation.");
    }
  }

  function startEdit(quotation: QuotationDetailDto) {
    setEditing(quotation);
    setPartyMode(quotation.customerId === null ? "typed" : "customer");
    setCustomerId(quotation.customerId);
    setPartyName(quotation.customerId === null ? quotation.customerName : "");
    setPartyPhone(quotation.customerId === null ? (quotation.customerPhone ?? "") : "");
    setQuotationDate(toDayInputValue(quotation.quotationDate));
    setValidUntil(quotation.validUntil ? toDayInputValue(quotation.validUntil) : "");
    setNotes(quotation.notes ?? "");
    setLines(quotation.items.map((item) => ({ ...makeLine(), description: item.description, qty: String(item.qty), rate: String(item.rateCents / 100) })));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(row: QuotationHistoryDto) {
    if (!window.confirm(`Delete quotation Q-${row.quotationNumber} for ${row.customerName}?`)) {
      return;
    }

    try {
      await window.stylecraft.quotations.delete(row.id);
      setMessage(`Quotation Q-${row.quotationNumber} deleted.`);

      if (preview?.id === row.id) {
        setPreview(null);
      }

      await Promise.all([loadHistory(), refreshNumber()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete the quotation.");
    }
  }

  function startConvert(quotation: QuotationDetailDto) {
    setConverting(quotation);
    setConvertDate(toDayInputValue());
    setAdvance(emptyAdvance());
    setPreview(null);
    setBill(null);
  }

  async function handleConvert() {
    if (converting === null) {
      return;
    }

    setError(null);
    const advanceCheck = readAdvance(advance, converting.totalAmountCents);

    if (advanceCheck.error) {
      setError(advanceCheck.error);
      return;
    }

    setIsSaving(true);

    try {
      const sale = await window.stylecraft.quotations.convertToSale(converting.id, {
        saleDate: convertDate,
        advanceCents: advanceCheck.cents,
        advanceMethod: advance.method,
        advanceReference: advance.method === "online" ? advance.reference || null : null,
      });

      setMessage(`Quotation Q-${converting.quotationNumber} is now Bill No. ${sale.billNumber} on ${sale.customerName}'s khata.`);
      setConverting(null);
      await Promise.all([loadHistory(), loadCustomers()]);
      setBill(await window.stylecraft.invoices.getBill(sale.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not make the bill.");
    } finally {
      setIsSaving(false);
    }
  }

  const partyOption = (value: PartyMode, label: string) => (
    <label
      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium ${
        partyMode === value ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
      }`}
    >
      <input checked={partyMode === value} className="sr-only" name="quotation-party-mode" onChange={() => setPartyMode(value)} type="radio" value={value} />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Quotation" title={editing ? `Edit Quotation Q-${editing.quotationNumber}` : "New quotation"}>
        Rates quoted to a party before the work. It stays off the khata; when the party agrees, turn it into a cash sale bill with one click.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-[140px_180px_180px]">
          <div className={labelClass}>
            Quotation No.
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 font-semibold text-slate-950 dark:border-slate-600 dark:text-slate-50">
              Q-{editing ? editing.quotationNumber : (nextNumber ?? "-")}
            </div>
          </div>
          <label className={labelClass} htmlFor="quotation-date">
            Date
            <input className={inputClass} id="quotation-date" onChange={(event) => setQuotationDate(event.target.value)} type="date" value={quotationDate} />
          </label>
          <label className={labelClass} htmlFor="quotation-valid">
            Valid till
            <input className={inputClass} id="quotation-valid" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} />
          </label>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Party</legend>
          <div className="flex gap-2">
            {partyOption("customer", "Customer list se")}
            {partyOption("typed", "Naya naam likhein")}
          </div>
          {partyMode === "customer" ? (
            <CustomerPicker customers={customers} id="quotation-customer" label="Customer" onChange={setCustomerId} onCustomerCreated={() => void loadCustomers()} value={customerId} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass} htmlFor="quotation-party-name">
                Name
                <input className={inputClass} id="quotation-party-name" onChange={(event) => setPartyName(event.target.value)} placeholder="Party ka naam" value={partyName} />
              </label>
              <label className={labelClass} htmlFor="quotation-party-phone">
                Phone
                <input className={inputClass} id="quotation-party-phone" onChange={(event) => setPartyPhone(event.target.value)} placeholder="Optional" value={partyPhone} />
              </label>
            </div>
          )}
        </fieldset>

        <ItemLinesEditor
          lines={lines}
          onAdd={() => setLines((current) => [...current, makeLine()])}
          onChange={updateLine}
          onRemove={(key) => setLines((current) => current.filter((entry) => entry.key !== key))}
          parsed={parsedLines}
        />

        <div className="flex justify-end">
          <div className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-right dark:border-slate-600 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">Quotation total</div>
            <div className="text-2xl font-bold text-slate-950 dark:text-slate-50" data-testid="quotation-form-total">
              {formatCurrency(totalCents)}
            </div>
          </div>
        </div>

        <label className={labelClass} htmlFor="quotation-notes">
          Notes
          <input className={inputClass} id="quotation-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Optional, e.g. rates for 1000 boxes" value={notes} />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save changes" : "Save quotation"}
          </Button>
          <Button onClick={resetForm} type="button" variant="ghost">
            {editing ? "Cancel edit" : "Clear"}
          </Button>
        </div>
      </form>

      {converting ? (
        <section aria-label="Make bill from quotation" className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900 dark:bg-brand-950/30">
          <div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Q-{converting.quotationNumber} se bill banayein — {converting.customerName}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ye cash sale bill {formatCurrency(converting.totalAmountCents)} ka banega aur khata mein jayega.
              {converting.customerId === null ? " Ye party abhi Customers mein nahi hai; bill ke saath naya customer ban jayega." : ""}
            </p>
          </div>
          <label className={`${labelClass} max-w-48`} htmlFor="quotation-convert-date">
            Bill date
            <input className={inputClass} id="quotation-convert-date" onChange={(event) => setConvertDate(event.target.value)} type="date" value={convertDate} />
          </label>
          <AdvanceFields idPrefix="quotation" onChange={setAdvance} totalCents={converting.totalAmountCents} value={advance} />
          <div className="flex gap-2">
            <Button disabled={isSaving} onClick={() => void handleConvert()} type="button">
              {isSaving ? "Saving..." : "Bill banayein"}
            </Button>
            <Button onClick={() => setConverting(null)} type="button" variant="ghost">
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {preview ? <QuotationPreview onClose={() => setPreview(null)} quotation={preview} /> : null}
      {bill ? <BillPreview bill={bill} onClose={() => setBill(null)} /> : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Quotation history</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {history.length} quotations · {history.filter((row) => row.convertedSaleId !== null).length} became bills
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass} htmlFor="quotation-search">
            Search
            <input className={inputClass} id="quotation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Q no., party, phone or item" value={search} />
          </label>
          <label className={labelClass} htmlFor="quotation-from">
            From
            <input className={inputClass} id="quotation-from" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          </label>
          <label className={labelClass} htmlFor="quotation-to">
            To
            <input className={inputClass} id="quotation-to" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 font-semibold">Q No.</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Party</th>
                <th className="px-3 py-3 font-semibold">Items</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-slate-500 dark:text-slate-400" colSpan={7}>
                    No quotations yet.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-950 dark:text-slate-50">Q-{row.quotationNumber}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.quotationDate)}</td>
                    <td className="px-3 py-3 text-slate-950 dark:text-slate-50">
                      {row.customerName}
                      {row.customerPhone ? <div className="text-xs text-slate-500 dark:text-slate-400">{row.customerPhone}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.itemNames.join(", ")}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(row.totalAmountCents)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.convertedBillNumber !== null ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">Bill No. {row.convertedBillNumber}</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button onClick={() => void openQuotation(row.id, (quotation) => { setBill(null); setPreview(quotation); })} size="sm" type="button" variant="ghost">
                          View / Print
                        </Button>
                        <Button onClick={() => void openQuotation(row.id, startEdit)} size="sm" type="button" variant="ghost">
                          Edit
                        </Button>
                        {row.convertedSaleId === null ? (
                          <Button onClick={() => void openQuotation(row.id, startConvert)} size="sm" type="button">
                            Bill banayein
                          </Button>
                        ) : null}
                        <Button onClick={() => void handleDelete(row)} size="sm" type="button" variant="ghost">
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
