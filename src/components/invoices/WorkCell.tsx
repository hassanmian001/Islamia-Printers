import { formatAmountOrBlank, formatQty, formatRate } from "@/lib/format";
import type { WorkCharge } from "@/types/stylecraft-api";

/** One kind of work on screen: the amount, and the "qty × rate" it came from underneath. */
export default function WorkCell({ charge }: { charge: WorkCharge }) {
  if (charge.amountCents === 0 && charge.qty === 0) {
    return <td className="px-2 py-2 text-right" />;
  }

  return (
    <td className="px-2 py-2 text-right text-slate-700 dark:text-slate-200">
      <div>{formatAmountOrBlank(charge.amountCents)}</div>
      <div className="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
        {formatQty(charge.qty)} × {formatRate(charge.rateCents)}
      </div>
    </td>
  );
}
