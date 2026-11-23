import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compactInputClass, compactTextInputClass } from "@/components/ui/form";
import { formatAmount, parseQuantity, parseRupeesToCents } from "@/lib/format";
import { workAmountCents } from "@/lib/job-math";
import type { CashSaleItemInput } from "@/types/stylecraft-api";

export type LineForm = { key: number; description: string; qty: string; rate: string };

export type ParsedLine = { input: CashSaleItemInput; amountCents: number; error: string | null };

export function parseLine(line: LineForm, index: number): ParsedLine {
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

type ItemLinesEditorProps = {
  lines: LineForm[];
  parsed: ParsedLine[];
  onChange: (key: number, field: keyof Omit<LineForm, "key">, value: string) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
};

/** Description / Qty / Rate / Amount lines, as on the bill book: used by Cash Sale and Quotation. */
export default function ItemLinesEditor({ lines, parsed, onChange, onAdd, onRemove }: ItemLinesEditorProps) {
  return (
    <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-brand-600 text-xs uppercase tracking-wide text-white">
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
                        className={compactTextInputClass}
                        onChange={(event) => onChange(line.key, "description", event.target.value)}
                        placeholder="e.g. 700g UV Round Corner Matt Card (500x2)"
                        value={line.description}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Line ${index + 1} quantity`}
                        className={compactInputClass}
                        inputMode="decimal"
                        onChange={(event) => onChange(line.key, "qty", event.target.value)}
                        placeholder="Qty"
                        value={line.qty}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Line ${index + 1} rate`}
                        className={compactInputClass}
                        inputMode="decimal"
                        onChange={(event) => onChange(line.key, "rate", event.target.value)}
                        placeholder="Rate"
                        value={line.rate}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-950 dark:text-slate-50" data-testid={`line-${index + 1}-amount`}>
                      {formatAmount(parsed[index].amountCents)}
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => onRemove(line.key)}
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

          <Button className="gap-2" onClick={onAdd} type="button" variant="ghost">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another line
          </Button>
    </>
  );
}
