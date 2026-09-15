import DocumentPanel from "@/components/invoices/DocumentPanel";
import ItemsTable from "@/components/invoices/ItemsTable";
import { formatCurrency } from "@/lib/currency";
import { buildInvoiceHtml, formatDocumentDate, invoiceDocumentFileName } from "@/lib/invoice-document";
import type { InvoiceDetailDto } from "@/types/stylecraft-api";

type InvoicePreviewProps = {
  invoice: InvoiceDetailDto;
  onClose: () => void;
};

/** One sale as the customer should see it: the shop, the buyer, every line item, and the total. */
export default function InvoicePreview({ invoice, onClose }: InvoicePreviewProps) {
  const { currencySymbol } = invoice.business;

  return (
    <DocumentPanel
      fileName={invoiceDocumentFileName(invoice)}
      html={buildInvoiceHtml(invoice)}
      kicker="Invoice"
      onClose={onClose}
      subtitle={`${formatDocumentDate(invoice.saleDate)} — ${invoice.paymentMethod ?? "No payment method"}`}
      title={`Invoice ${invoice.invoiceNumber}`}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <h4 className="font-semibold text-slate-950 dark:text-slate-50">Business</h4>
          <p className="mt-2 font-medium text-slate-800 dark:text-slate-100">{invoice.business.businessName}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.business.phone ?? "No phone"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.business.email ?? "No email"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.business.address ?? "No address"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <h4 className="font-semibold text-slate-950 dark:text-slate-50">Bill to</h4>
          <p className="mt-2 font-medium text-slate-800 dark:text-slate-100">{invoice.customerName ?? "Walk-in customer"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.customerPhone ?? "No phone"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.customerEmail ?? "No email"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.customerAddress ?? "No address"}</p>
        </div>
      </div>

      <div className="mt-4">
        <ItemsTable currencySymbol={currencySymbol} items={invoice.items} />
      </div>

      <div className="mt-4 grid gap-2 text-sm md:ml-auto md:w-80">
        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>Subtotal</span>
          <span>{formatCurrency(invoice.subtotalCents, currencySymbol)}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>Discount</span>
          <span>{formatCurrency(invoice.discountAmountCents, currencySymbol)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-lg font-bold text-slate-950 dark:text-slate-50">
          <span>Total</span>
          <span>{formatCurrency(invoice.totalAmountCents, currencySymbol)}</span>
        </div>
      </div>

      {invoice.notes ? (
        <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <h4 className="font-semibold text-slate-950 dark:text-slate-50">Notes</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{invoice.notes}</p>
        </div>
      ) : null}
    </DocumentPanel>
  );
}
