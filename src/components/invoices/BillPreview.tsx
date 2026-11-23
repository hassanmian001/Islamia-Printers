import BillBookPreview from "@/components/invoices/BillBookPreview";
import { buildBillHtml } from "@/lib/bill-book";
import { billDocumentFileName, billMoney, formatDocumentDate, paymentMethodLabel } from "@/lib/invoice-document";
import type { BillDocumentDto } from "@/types/stylecraft-api";

type BillPreviewProps = {
  bill: BillDocumentDto;
  onClose: () => void;
};

/** One bill on the shop's A5 bill-book page, printed whole or as details only onto a pre-printed pad. */
export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  return (
    <BillBookPreview
      baseFileName={billDocumentFileName(bill)}
      buildHtml={(options) => buildBillHtml(bill, options)}
      idPrefix={`bill-${bill.id}`}
      kicker={bill.kind === "cash" ? "Cash sale bill" : "Bill"}
      onClose={onClose}
      subtitle={`${formatDocumentDate(bill.saleDate)} — ${bill.customerName}`}
      summary={
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
      }
      title={`Bill No. ${bill.billNumber}`}
    />
  );
}
