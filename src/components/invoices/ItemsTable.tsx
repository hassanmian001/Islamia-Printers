import { formatCurrency } from "@/lib/currency";
import type { InvoiceLineItemDto } from "@/types/stylecraft-api";

type ItemsTableProps = {
  items: InvoiceLineItemDto[];
  currencySymbol: string;
};

/** The line items of one invoice: what was bought, in which size and colour, and at what price. */
export default function ItemsTable({ items, currencySymbol }: ItemsTableProps) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCents = items.reduce((sum, item) => sum + item.totalAmountCents, 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold">Item</th>
            <th className="px-4 py-3 font-semibold">Size / colour</th>
            <th className="px-4 py-3 font-semibold">Qty</th>
            <th className="px-4 py-3 font-semibold">Rate</th>
            <th className="px-4 py-3 font-semibold">Discount</th>
            <th className="px-4 py-3 font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {items.length === 0 ? (
            <tr>
              <td className="px-4 py-4 text-slate-500 dark:text-slate-400" colSpan={6}>
                No items on this invoice.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                  {item.productName}
                  <div className="text-xs text-slate-500 dark:text-slate-400">{item.productSku}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.variantLabel}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(item.unitPriceCents, currencySymbol)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(item.discountAmountCents, currencySymbol)}</td>
                <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(item.totalAmountCents, currencySymbol)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-950 dark:text-slate-50">
          <tr>
            <td className="px-4 py-3" colSpan={2}>
              Total
            </td>
            <td className="px-4 py-3">{totalQuantity}</td>
            <td className="px-4 py-3" colSpan={2} />
            <td className="px-4 py-3">{formatCurrency(totalCents, currencySymbol)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
