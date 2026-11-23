import { Button } from "@/components/ui/button";
import WorkCell from "@/components/invoices/WorkCell";
import { formatAmount, formatAmountOrBlank, formatDate, formatQty, formatRate } from "@/lib/format";
import { billNumberLabel, paymentNarration, receiptNumberLabel } from "@/lib/invoice-document";
import { workKinds, workLabels } from "@/lib/job-math";
import type { LedgerStatementDto } from "@/types/stylecraft-api";

type LedgerTableProps = {
  statement: LedgerStatementDto;
  onViewBill?: (saleId: number) => void;
  onDeletePayment?: (paymentId: number, receiptNumber: number) => void;
};

const cell = "px-2 py-2";
const num = "px-2 py-2 text-right whitespace-nowrap";

/** The khata on screen, row for row the same as the printed statement of account. */
export default function LedgerTable({ statement, onViewBill, onDeletePayment }: LedgerTableProps) {
  const hasActions = onViewBill !== undefined || onDeletePayment !== undefined;
  const emptyWork = workKinds.map((kind) => <td className={cell} key={kind} />);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className={`${cell} font-semibold`}>Date</th>
            <th className={`${cell} font-semibold`}>V/No</th>
            <th className={`${cell} font-semibold`}>Job name / narration</th>
            {workKinds.map((kind) => (
              <th className={`${num} font-semibold`} key={kind}>
                {workLabels[kind]}
              </th>
            ))}
            <th className={`${num} font-semibold`}>Debit</th>
            <th className={`${num} font-semibold`}>Credit</th>
            <th className={`${num} font-semibold`}>Balance</th>
            {hasActions ? <th className={`${cell} font-semibold`} /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          <tr className="bg-amber-50/60 dark:bg-amber-950/20">
            <td className={cell} />
            <td className={cell}>OB</td>
            <td className={`${cell} font-medium`}>Opening balance</td>
            {emptyWork}
            <td className={cell} />
            <td className={cell} />
            <td className={`${num} font-semibold`}>{formatAmount(statement.openingBalanceCents)}</td>
            {hasActions ? <td className={cell} /> : null}
          </tr>

          {statement.entries.map((entry) =>
            entry.kind === "payment" ? (
              <tr className="bg-green-50/60 dark:bg-green-950/20" key={`payment-${entry.paymentId}`}>
                <td className={`${cell} whitespace-nowrap`}>{formatDate(entry.date)}</td>
                <td className={`${cell} whitespace-nowrap`}>{receiptNumberLabel(entry.receiptNumber)}</td>
                <td className={cell}>{paymentNarration(entry)}</td>
                {emptyWork}
                <td className={cell} />
                <td className={`${num} font-medium text-green-700 dark:text-green-400`}>{formatAmount(entry.amountCents)}</td>
                <td className={`${num} font-semibold`}>{formatAmount(entry.balanceCents)}</td>
                {hasActions ? (
                  <td className={cell}>
                    {onDeletePayment && entry.billNumber === null ? (
                      <Button onClick={() => onDeletePayment(entry.paymentId, entry.receiptNumber)} size="sm" type="button" variant="ghost">
                        Delete
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ) : (
              [
                ...entry.items.map((item, index) => (
                  <tr key={`item-${item.id}`}>
                    <td className={`${cell} whitespace-nowrap`}>{formatDate(entry.date)}</td>
                    <td className={`${cell} whitespace-nowrap`}>{billNumberLabel(entry.billNumber, entry.saleKind)}</td>
                    <td className={cell}>
                      <div className="font-medium text-slate-950 dark:text-slate-50">{item.description}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatQty(item.qty)} × {formatRate(item.rateCents)}
                      </div>
                    </td>
                    {emptyWork}
                    <td className={num}>{formatAmount(item.amountCents)}</td>
                    <td className={cell} />
                    <td className={num}>{formatAmount(item.balanceCents)}</td>
                    {hasActions ? (
                      <td className={cell}>
                        {index === 0 && onViewBill ? (
                          <Button onClick={() => onViewBill(entry.saleId)} size="sm" type="button" variant="ghost">
                            View
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )),
                ...entry.jobs.map((job, index) => (
                  <tr key={`job-${job.id}`}>
                    <td className={`${cell} whitespace-nowrap`}>{formatDate(entry.date)}</td>
                    <td className={`${cell} whitespace-nowrap`}>{billNumberLabel(entry.billNumber, entry.saleKind)}</td>
                    <td className={`${cell} font-medium text-slate-950 dark:text-slate-50`}>{job.jobName}</td>
                    {workKinds.map((kind) => (
                      <WorkCell charge={job[kind]} key={kind} />
                    ))}
                    <td className={num}>{formatAmount(job.totalAmountCents)}</td>
                    <td className={cell} />
                    <td className={num}>{formatAmount(job.balanceCents)}</td>
                    {hasActions ? (
                      <td className={cell}>
                        {index === 0 && onViewBill ? (
                          <Button onClick={() => onViewBill(entry.saleId)} size="sm" type="button" variant="ghost">
                            View
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )),
                <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold" key={`subtotal-${entry.saleId}`}>
                  <td className={`${cell} text-right`} colSpan={3}>
                    Sub-Total &gt;&gt;&gt;&gt;&gt;
                  </td>
                  {workKinds.map((kind) => (
                    <td className={num} key={kind}>
                      {formatAmountOrBlank(entry.workTotals[kind])}
                    </td>
                  ))}
                  <td className={num}>{formatAmount(entry.totalAmountCents)}</td>
                  <td className={cell} />
                  <td className={num}>{formatAmount(entry.balanceCents)}</td>
                  {hasActions ? <td className={cell} /> : null}
                </tr>,
              ]
            ),
          )}

          {statement.entries.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-slate-500 dark:text-slate-400" colSpan={hasActions ? 12 : 11}>
                No bills or payments in this period.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot className="border-t-2 border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 font-bold text-slate-950 dark:text-slate-50">
          <tr>
            <td className={cell} colSpan={3}>
              Grand Total
            </td>
            {workKinds.map((kind) => (
              <td className={num} key={kind}>
                {formatAmountOrBlank(statement.workTotals[kind])}
              </td>
            ))}
            <td className={num}>{formatAmountOrBlank(statement.debitCents)}</td>
            <td className={num}>{formatAmountOrBlank(statement.creditCents)}</td>
            <td className={num}>{formatAmount(statement.closingBalanceCents)}</td>
            {hasActions ? <td className={cell} /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
