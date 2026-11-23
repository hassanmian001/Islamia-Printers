import PaymentMethodToggle from "@/components/payments/PaymentMethodToggle";
import { inputClass, labelClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { parseRupeesToCents } from "@/lib/format";
import type { PaymentMethod } from "@/types/stylecraft-api";

export type AdvanceForm = {
  amount: string;
  method: PaymentMethod;
  reference: string;
};

export function emptyAdvance(): AdvanceForm {
  return { amount: "", method: "cash", reference: "" };
}

type AdvanceFieldsProps = {
  idPrefix: string;
  totalCents: number;
  value: AdvanceForm;
  onChange: (value: AdvanceForm) => void;
};

/** Total / Adv. / Bal. for a bill: the advance taken now, how it came in, and what is left on the khata. */
export default function AdvanceFields({ idPrefix, totalCents, value, onChange }: AdvanceFieldsProps) {
  const advanceCents = parseRupeesToCents(value.amount) ?? 0;
  const balanceCents = totalCents - advanceCents;

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-4 md:grid-cols-[1fr_1fr_auto]">
      <div className="grid gap-3">
        <label className={labelClass} htmlFor={`${idPrefix}-advance`}>
          Advance received now
          <input
            className={inputClass}
            id={`${idPrefix}-advance`}
            inputMode="decimal"
            onChange={(event) => onChange({ ...value, amount: event.target.value })}
            placeholder="0"
            value={value.amount}
          />
        </label>
        <button
          className="justify-self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => onChange({ ...value, amount: totalCents > 0 ? String(totalCents / 100) : "" })}
          type="button"
        >
          Paid in full
        </button>
      </div>
      <div className="grid content-start gap-3">
        <PaymentMethodToggle name={`${idPrefix}-advance-method`} onChange={(method) => onChange({ ...value, method })} value={value.method} />
        {value.method === "online" ? (
          <label className={labelClass} htmlFor={`${idPrefix}-advance-reference`}>
            Online detail
            <input
              className={inputClass}
              id={`${idPrefix}-advance-reference`}
              onChange={(event) => onChange({ ...value, reference: event.target.value })}
              placeholder="JazzCash / Easypaisa / bank, TID"
              value={value.reference}
            />
          </label>
        ) : null}
      </div>
      <dl className="grid min-w-52 content-start gap-1 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500 dark:text-slate-400">Total</dt>
          <dd className="font-semibold text-slate-950 dark:text-slate-50" data-testid={`${idPrefix}-total`}>
            {formatCurrency(totalCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-slate-500 dark:text-slate-400">Adv.</dt>
          <dd className="text-slate-950 dark:text-slate-50">{formatCurrency(advanceCents)}</dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-slate-200 dark:border-slate-700 pt-1">
          <dt className="font-semibold text-slate-700 dark:text-slate-200">Bal.</dt>
          <dd className={`text-lg font-bold ${balanceCents < 0 ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-slate-50"}`} data-testid={`${idPrefix}-balance`}>
            {formatCurrency(balanceCents)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Checks the advance against the bill total; returns the advance in paisa or a message to show. */
export function readAdvance(value: AdvanceForm, totalCents: number): { cents: number; error: string | null } {
  const cents = parseRupeesToCents(value.amount);

  if (cents === null || cents < 0) {
    return { cents: 0, error: "Advance is not a valid amount." };
  }

  if (cents > totalCents) {
    return { cents, error: "Advance cannot be more than the bill total." };
  }

  return { cents, error: null };
}

export function advanceFromSale(sale: { advanceCents: number; advanceMethod: PaymentMethod | null; advanceReference: string | null }): AdvanceForm {
  return {
    amount: sale.advanceCents === 0 ? "" : String(sale.advanceCents / 100),
    method: sale.advanceMethod ?? "cash",
    reference: sale.advanceReference ?? "",
  };
}
