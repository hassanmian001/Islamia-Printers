import DocumentPanel from "@/components/invoices/DocumentPanel";
import { formatQty, formatRate } from "@/lib/format";
import { billDocumentFileName, billLines, billMoney, buildBillHtml, formatDocumentDate, paymentMethodLabel } from "@/lib/invoice-document";
import type { BillDocumentDto } from "@/types/stylecraft-api";

type BillPreviewProps = {
  bill: BillDocumentDto;
  onClose: () => void;
};

/** One bill as the customer will get it — Description / Qty / Rate / Amount, then Total, Adv. and Bal. — ready to print or save as PDF. */
export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  const lines = billLines(bill);

  return (
    <DocumentPanel
      fileName={billDocumentFileName(bill)}
      html={buildBillHtml(bill)}
      kicker={bill.kind === "cash" ? "Cash sale bill" : "Bill"}
      onClose={onClose}
      subtitle={`${formatDocumentDate(bill.saleDate)} — ${bill.customerName}`}
      title={`Bill No. ${bill.billNumber}`}
    >
      <div className="overflow-x-auto rounded-2xl border border-rose-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-600 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 text-center font-semibold">Qty.</th>
              <th className="px-3 py-2 text-center font-semibold">Rate</th>
              <th className="px-3 py-2 text-center font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className={`px-3 py-1.5 ${line.kind === "head" ? "font-semibold text-slate-950 dark:text-slate-50" : line.kind === "sub" ? "pl-8 text-slate-600 dark:text-slate-300" : "text-slate-950 dark:text-slate-50"}`}>
                  {line.description}
                </td>
                <td className="px-3 py-1.5 text-center">{line.qty === null ? "" : formatQty(line.qty)}</td>
                <td className="px-3 py-1.5 text-center">{line.rateCents === null ? "" : formatRate(line.rateCents)}</td>
                <td className="px-3 py-1.5 text-center">{line.amountCents === null ? "" : billMoney(line.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 grid gap-1 text-sm md:ml-auto md:w-72">
        <div className="flex justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 font-semibold text-slate-950 dark:text-slate-50">
          <dt>Total</dt>
          <dd>{billMoney(bill.totalAmountCents)}</dd>
        </div>
        <div className="flex justify-between px-3 py-1.5 text-slate-700 dark:text-slate-200">
          <dt>Adv.{bill.advanceCents > 0 && bill.advanceMethod ? ` (${paymentMethodLabel(bill.advanceMethod)})` : ""}</dt>
          <dd>{billMoney(bill.advanceCents)}</dd>
        </div>
        <div className="flex justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 font-semibold text-slate-950 dark:text-slate-50">
          <dt>Bal.</dt>
          <dd data-testid="bill-balance">{billMoney(bill.balanceCents)}</dd>
        </div>
      </dl>
      {bill.notes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Notes: {bill.notes}</p> : null}
    </DocumentPanel>
  );
}
