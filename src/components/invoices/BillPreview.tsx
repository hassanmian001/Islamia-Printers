import DocumentPanel from "@/components/invoices/DocumentPanel";
import WorkCell from "@/components/invoices/WorkCell";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, formatAmountOrBlank } from "@/lib/format";
import { billDocumentFileName, buildBillHtml, formatDocumentDate } from "@/lib/invoice-document";
import { workKinds, workLabels } from "@/lib/job-math";
import type { BillDocumentDto } from "@/types/stylecraft-api";

type BillPreviewProps = {
  bill: BillDocumentDto;
  onClose: () => void;
};

/** One bill as the customer should see it, ready to print or save as PDF. */
export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  return (
    <DocumentPanel
      fileName={billDocumentFileName(bill)}
      html={buildBillHtml(bill)}
      kicker="Bill"
      onClose={onClose}
      subtitle={`${formatDocumentDate(bill.saleDate)} — ${bill.customerName}`}
      title={`Bill No. ${bill.billNumber}`}
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2 font-semibold">Job name</th>
              {workKinds.map((kind) => (
                <th className="px-2 py-2 text-right font-semibold" key={kind}>
                  {workLabels[kind]}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">Grand Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bill.jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-2 py-2 font-medium text-slate-950 dark:text-slate-50">{job.jobName}</td>
                {workKinds.map((kind) => (
                  <WorkCell charge={job[kind]} key={kind} />
                ))}
                <td className="px-2 py-2 text-right font-semibold text-slate-950 dark:text-slate-50">{formatAmount(job.totalAmountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-950 dark:text-slate-50">
            <tr>
              <td className="px-2 py-2">Total</td>
              {workKinds.map((kind) => (
                <td className="px-2 py-2 text-right" key={kind}>
                  {formatAmountOrBlank(bill.jobs.reduce((sum, job) => sum + job[kind].amountCents, 0))}
                </td>
              ))}
              <td className="px-2 py-2 text-right">{formatCurrency(bill.totalAmountCents, bill.business.currencySymbol)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {bill.notes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Notes: {bill.notes}</p> : null}
    </DocumentPanel>
  );
}
