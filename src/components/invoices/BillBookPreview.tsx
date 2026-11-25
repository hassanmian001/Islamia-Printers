import { useState, type ReactNode } from "react";

import DocumentPanel from "@/components/invoices/DocumentPanel";
import { inputClass } from "@/components/ui/form";
import { billBookFileSuffix, type BillPrintMode, type BillPrintOptions } from "@/lib/bill-book";

type BillBookPreviewProps = {
  /** Keeps form control ids unique when two previews are open. */
  idPrefix: string;
  kicker: string;
  title: string;
  subtitle: string;
  baseFileName: string;
  buildHtml: (options: BillPrintOptions) => string;
  /** Totals and notes shown beside the page. */
  summary: ReactNode;
  onClose: () => void;
};

// Remembered on this PC: the printer and the bill-book pad belong to the machine, not the document.
/** How far the details can be nudged either way, in millimetres. */
export const OFFSET_LIMIT_MM = 50;

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
    /* Storage may be blocked; the choice then lasts for this document only. */
  }
}

const modes: Array<{ value: BillPrintMode; label: string; hint: string }> = [
  { value: "full", label: "Poora bill", hint: "Saade A5 kaghaz par: design aur detail dono" },
  { value: "details", label: "Sirf detail", hint: "Chhapi hui bill book par: sirf likhai, kaale rang mein" },
];

/** A document on the shop's A5 bill-book page, printed whole or as details only onto a pre-printed pad. */
export default function BillBookPreview({ idPrefix, kicker, title, subtitle, baseFileName, buildHtml, summary, onClose }: BillBookPreviewProps) {
  const [mode, setMode] = useState<BillPrintMode>(readMode);
  const [offset, setOffset] = useState(readOffset);

  function chooseMode(next: BillPrintMode) {
    setMode(next);
    remember(modeKey, next);
  }

  function changeOffset(axis: "x" | "y", value: string) {
    const parsed = Number(value);
    const next = { ...offset, [axis]: Number.isFinite(parsed) ? Math.max(-OFFSET_LIMIT_MM, Math.min(OFFSET_LIMIT_MM, parsed)) : 0 };
    setOffset(next);
    remember(offsetKey, JSON.stringify(next));
  }

  const html = buildHtml({ mode, offsetXMm: offset.x, offsetYMm: offset.y });

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
              <input checked={mode === option.value} className="sr-only" name={`${idPrefix}-print-mode`} onChange={() => chooseMode(option.value)} type="radio" value={option.value} />
              <span className="font-semibold">{option.label}</span>
              <span className={`text-xs ${mode === option.value ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "details" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`${idPrefix}-offset-x`}>
            Right / left (mm)
            <input className={`${inputClass} w-28`} id={`${idPrefix}-offset-x`} max={OFFSET_LIMIT_MM} min={-OFFSET_LIMIT_MM} onChange={(event) => changeOffset("x", event.target.value)} step="0.5" type="number" value={offset.x} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`${idPrefix}-offset-y`}>
            Down / up (mm)
            <input className={`${inputClass} w-28`} id={`${idPrefix}-offset-y`} max={OFFSET_LIMIT_MM} min={-OFFSET_LIMIT_MM} onChange={(event) => changeOffset("y", event.target.value)} step="0.5" type="number" value={offset.y} />
          </label>
          <p className="max-w-56 text-xs text-slate-500 dark:text-slate-400">Agar likhai boxes se thodi hat kar chhape to yahan adjust karein. Ye setting is PC par yaad rahegi.</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <DocumentPanel
      fileName={`${baseFileName}${billBookFileSuffix(mode)}`}
      html={html}
      kicker={kicker}
      onClose={onClose}
      pageSize="A5"
      subtitle={subtitle}
      title={title}
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
            title={`${title} print preview`}
          />
        </div>
        {summary}
      </div>
    </DocumentPanel>
  );
}
