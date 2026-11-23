import { useState } from "react";

import DocumentPanel from "@/components/invoices/DocumentPanel";
import { inputClass } from "@/components/ui/form";
import { billBookFileSuffix, buildBillHtml, type BillPrintMode } from "@/lib/bill-book";
import { billDocumentFileName, billMoney, formatDocumentDate, paymentMethodLabel } from "@/lib/invoice-document";
import type { BillDocumentDto } from "@/types/stylecraft-api";

type BillPreviewProps = {
  bill: BillDocumentDto;
  onClose: () => void;
};

// Remembered on this PC: the printer and the bill-book pad belong to the machine, not the bill.
const modeKey = "islamia.billPrint.mode";
const offsetKey = "islamia.billPrint.offset";

function readMode(): BillPrintMode {
  try {
    return window.localStorage.getItem(modeKey) === "details" ? "details" : "full";
  } catch {
    return "full";
  }
}

function readOffset(): { x: number; y: number } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(offsetKey) ?? "{}") as { x?: unknown; y?: unknown };
    return { x: typeof parsed.x === "number" ? parsed.x : 0, y: typeof parsed.y === "number" ? parsed.y : 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage may be blocked; the choice then lasts for this bill only. */
  }
}

const modes: Array<{ value: BillPrintMode; label: string; hint: string }> = [
  { value: "full", label: "Poora bill", hint: "Saade A5 kaghaz par: design aur detail dono" },
  { value: "details", label: "Sirf detail", hint: "Chhapi hui bill book par: sirf likhai, kaale rang mein" },
];

/** One bill on the shop's A5 bill-book page, printed whole or as details only onto a pre-printed pad. */
export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  const [mode, setMode] = useState<BillPrintMode>(readMode);
  const [offset, setOffset] = useState(readOffset);

  function chooseMode(next: BillPrintMode) {
    setMode(next);
    remember(modeKey, next);
  }

  function changeOffset(axis: "x" | "y", value: string) {
    const parsed = Number(value);
    const next = { ...offset, [axis]: Number.isFinite(parsed) ? Math.max(-20, Math.min(20, parsed)) : 0 };
    setOffset(next);
    remember(offsetKey, JSON.stringify(next));
  }

  const html = buildBillHtml(bill, { mode, offsetXMm: offset.x, offsetYMm: offset.y });

  const toolbar = (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60 lg:flex-row lg:items-end lg:justify-between">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Print kaise karna hai?</legend>
        <div className="flex flex-wrap gap-2">
          {modes.map((option) => (
            <label
              className={`flex cursor-pointer flex-col rounded-xl border px-4 py-2 text-sm ${
                mode === option.value
                  ? "border-brand-600 bg-brand-600 text-white shadow-brand"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              }`}
              key={option.value}
            >
              <input checked={mode === option.value} className="sr-only" name={`bill-print-mode-${bill.id}`} onChange={() => chooseMode(option.value)} type="radio" value={option.value} />
              <span className="font-semibold">{option.label}</span>
              <span className={`text-xs ${mode === option.value ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "details" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`bill-offset-x-${bill.id}`}>
            Right / left (mm)
            <input
              className={`${inputClass} w-28`}
              id={`bill-offset-x-${bill.id}`}
              onChange={(event) => changeOffset("x", event.target.value)}
              step="0.5"
              type="number"
              value={offset.x}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`bill-offset-y-${bill.id}`}>
            Down / up (mm)
            <input
              className={`${inputClass} w-28`}
              id={`bill-offset-y-${bill.id}`}
              onChange={(event) => changeOffset("y", event.target.value)}
              step="0.5"
              type="number"
              value={offset.y}
            />
          </label>
          <p className="max-w-56 text-xs text-slate-500 dark:text-slate-400">Agar likhai boxes se thodi hat kar chhape to yahan adjust karein. Ye setting is PC par yaad rahegi.</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <DocumentPanel
      fileName={`${billDocumentFileName(bill)}${billBookFileSuffix(mode)}`}
      html={html}
      kicker={bill.kind === "cash" ? "Cash sale bill" : "Bill"}
      onClose={onClose}
      pageSize="A5"
      subtitle={`${formatDocumentDate(bill.saleDate)} — ${bill.customerName}`}
      title={`Bill No. ${bill.billNumber}`}
      toolbar={toolbar}
    >
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        {/* Exactly what will print, at roughly two-thirds size. */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-card dark:border-slate-700" style={{ width: "98.7mm", height: "140mm" }}>
          <iframe
            className="origin-top-left bg-white"
            sandbox=""
            srcDoc={html}
            style={{ width: "148mm", height: "210mm", border: 0, transform: "scale(0.6667)" }}
            title={`Bill ${bill.billNumber} print preview`}
          />
        </div>

        <dl className="grid content-start gap-1 text-sm md:w-72">
          <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 font-semibold text-slate-950 dark:bg-slate-800/60 dark:text-slate-50">
            <dt>Total</dt>
            <dd>{billMoney(bill.totalAmountCents)}</dd>
          </div>
          <div className="flex justify-between px-3 py-1.5 text-slate-700 dark:text-slate-200">
            <dt>P. Bal (pichla)</dt>
            <dd data-testid="bill-previous-balance">{billMoney(bill.previousBalanceCents)}</dd>
          </div>
          <div className="flex justify-between px-3 py-1.5 text-slate-700 dark:text-slate-200">
            <dt>Adv.{bill.advanceCents > 0 && bill.advanceMethod ? ` (${paymentMethodLabel(bill.advanceMethod)})` : ""}</dt>
            <dd>{billMoney(bill.advanceCents)}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-brand-50 px-3 py-1.5 font-bold text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            <dt>Bal.</dt>
            <dd data-testid="bill-balance">{billMoney(bill.closingBalanceCents)}</dd>
          </div>
          {bill.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Notes: {bill.notes}</p> : null}
        </dl>
      </div>
    </DocumentPanel>
  );
}
