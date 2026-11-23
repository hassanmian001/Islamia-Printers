import BillBookPreview from "@/components/invoices/BillBookPreview";
import { buildQuotationHtml } from "@/lib/bill-book";
import { billMoney, formatDocumentDate } from "@/lib/invoice-document";
import type { QuotationDetailDto } from "@/types/stylecraft-api";

type QuotationPreviewProps = {
  quotation: QuotationDetailDto;
  onClose: () => void;
};

/** A quotation on the bill-book page, headed QUOTATION, printed whole or as details only. */
export default function QuotationPreview({ quotation, onClose }: QuotationPreviewProps) {
  return (
    <BillBookPreview
      baseFileName={`Quotation Q-${quotation.quotationNumber} ${quotation.customerName}`}
      buildHtml={(options) => buildQuotationHtml(quotation, options)}
      idPrefix={`quotation-${quotation.id}`}
      kicker="Quotation"
      onClose={onClose}
      subtitle={`${formatDocumentDate(quotation.quotationDate)} — ${quotation.customerName}`}
      summary={
        <dl className="grid content-start gap-1 text-sm md:w-72">
          <div className="flex justify-between rounded-lg bg-brand-50 px-3 py-1.5 font-bold text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            <dt>Total</dt>
            <dd data-testid="quotation-total">{billMoney(quotation.totalAmountCents)}</dd>
          </div>
          {quotation.validUntil ? (
            <div className="flex justify-between px-3 py-1.5 text-slate-700 dark:text-slate-200">
              <dt>Valid till</dt>
              <dd>{formatDocumentDate(quotation.validUntil)}</dd>
            </div>
          ) : null}
          {quotation.convertedBillNumber !== null ? (
            <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-300">Bill No. {quotation.convertedBillNumber} ban chuka hai.</p>
          ) : null}
          {quotation.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Notes: {quotation.notes}</p> : null}
        </dl>
      }
      title={`Quotation Q-${quotation.quotationNumber}`}
    />
  );
}
