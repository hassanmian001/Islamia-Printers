import DocumentPanel from "@/components/invoices/DocumentPanel";
import ItemsTable from "@/components/invoices/ItemsTable";
import { formatCurrency } from "@/lib/currency";
import { buildStatementHtml, formatDocumentDate, statementDocumentFileName } from "@/lib/invoice-document";
import type { CustomerStatementDto, StatementEntryDto } from "@/types/stylecraft-api";

type StatementPreviewProps = {
  statement: CustomerStatementDto;
  onClose: () => void;
};

const entryLabels: Record<StatementEntryDto["kind"], string> = {
  opening: "Opening balance",
  sale: "Sale",
  purchase: "Purchase",
  payment: "Payment",
  sale_return: "Sale return",
  purchase_return: "Purchase return",
};

/** The customer's whole khata in one document: the running balance, then what each invoice was made of. */
export default function StatementPreview({ statement, onClose }: StatementPreviewProps) {
  const { currencySymbol } = statement.business;
  const money = (cents: number) => formatCurrency(cents, currencySymbol);
  const sales = statement.entries.map((entry) => entry.sale).filter((sale): sale is NonNullable<StatementEntryDto["sale"]> => sale !== null);

  return (
    <DocumentPanel
      fileName={statementDocumentFileName(statement)}
      html={buildStatementHtml(statement)}
      kicker="Account statement"
      onClose={onClose}
      subtitle={`Prepared ${formatDocumentDate(statement.generatedAt)}`}
      title={statement.customerName}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <h4 className="font-semibold text-slate-950 dark:text-slate-50">Customer</h4>
          <p className="mt-2 font-medium text-slate-800 dark:text-slate-100">{statement.customerName}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{statement.customerPhone ?? "No phone"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{statement.customerEmail ?? "No email"}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{statement.customerAddress ?? "No address"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4">
          <h4 className="font-semibold text-slate-950 dark:text-slate-50">Summary</h4>
          <dl className="mt-2 grid grid-cols-2 gap-1 text-sm text-slate-600 dark:text-slate-300">
            <dt>Opening balance</dt>
            <dd className="text-right">{money(statement.openingBalanceCents)}</dd>
            <dt>Invoiced</dt>
            <dd className="text-right">{money(statement.invoicedCents)}</dd>
            <dt>Paid</dt>
            <dd className="text-right">{money(statement.paidCents)}</dd>
            <dt>Returned</dt>
            <dd className="text-right">{money(statement.returnedCents)}</dd>
            <dt className="font-semibold text-slate-950 dark:text-slate-50">{statement.balanceCents > 0 ? "Balance due" : "Balance"}</dt>
            <dd className="text-right font-semibold text-slate-950 dark:text-slate-50">{money(statement.balanceCents)}</dd>
          </dl>
        </div>
      </div>

      <h4 className="mt-6 font-semibold text-slate-950 dark:text-slate-50">Khata</h4>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Entry</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Debit</th>
              <th className="px-4 py-3 font-semibold">Credit</th>
              <th className="px-4 py-3 font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {statement.entries.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500 dark:text-slate-400" colSpan={6}>
                  No entries yet.
                </td>
              </tr>
            ) : (
              statement.entries.map((entry, index) => (
                <tr key={`${entry.kind}-${entry.reference}-${index}`}>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDocumentDate(entry.date)}</td>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">{entryLabels[entry.kind]}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{entry.reference}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{entry.debitCents === 0 ? "-" : money(entry.debitCents)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{entry.creditCents === 0 ? "-" : money(entry.creditCents)}</td>
                  <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">{money(entry.balanceCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sales.length === 0 ? null : (
        <>
          <h4 className="mt-6 font-semibold text-slate-950 dark:text-slate-50">Item details</h4>
          <div className="mt-2 space-y-4">
            {sales.map((sale) => (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4" key={sale.saleId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-950 dark:text-slate-50">Invoice {sale.invoiceNumber}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{formatDocumentDate(sale.saleDate)}</span>
                </div>
                <div className="mt-3">
                  <ItemsTable currencySymbol={currencySymbol} items={sale.items} />
                </div>
                <div className="mt-3 flex justify-end gap-6 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Discount {money(sale.discountAmountCents)}</span>
                  <span className="font-semibold text-slate-950 dark:text-slate-50">Invoice total {money(sale.totalAmountCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DocumentPanel>
  );
}
