import { styleCraftLogoDataUri } from "@/lib/branding";
import { formatCurrency } from "@/lib/currency";
import type { CustomerStatementDto, InvoiceBusinessSettingsDto, InvoiceDetailDto, InvoiceLineItemDto, StatementEntryDto } from "@/types/stylecraft-api";

const entryLabels: Record<StatementEntryDto["kind"], string> = {
  opening: "Opening balance",
  sale: "Sale",
  purchase: "Purchase",
  payment: "Payment",
  sale_return: "Sale return",
  purchase_return: "Purchase return",
};

const documentStyles = `
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;margin:28px;color:#0f172a;font-size:13px}
  h1{font-size:22px;margin:0}
  h2{font-size:18px;margin:0}
  h3{font-size:14px;margin:26px 0 8px}
  .header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #0f172a;padding-bottom:16px}
  .brand{display:flex;align-items:center;gap:14px}
  .logo{width:58px;height:58px;object-fit:contain}
  .muted{color:#475569;font-size:12px}
  .right{text-align:right}
  .boxes{display:flex;gap:16px;margin-top:18px}
  .box{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:12px}
  .box strong{display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#334155}
  table{border-collapse:collapse;width:100%;margin-top:8px;font-size:12px}
  th,td{border:1px solid #cbd5e1;padding:7px 8px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  td.num,th.num{text-align:right;white-space:nowrap}
  tfoot td{font-weight:700;background:#f8fafc}
  .totals{margin-left:auto;margin-top:14px;width:290px}
  .totals div{display:flex;justify-content:space-between;padding:5px 0}
  .totals .total{font-weight:700;border-top:1px solid #cbd5e1;font-size:15px}
  .sale{margin-top:18px;border:1px solid #cbd5e1;border-radius:10px;padding:12px;page-break-inside:avoid}
  .sale-head{display:flex;justify-content:space-between;gap:12px;font-weight:700}
  .due{margin-top:18px;border:2px solid #0f172a;border-radius:10px;padding:12px;display:flex;justify-content:space-between;font-size:16px;font-weight:700}
  .foot{margin-top:26px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b;text-align:center}
`;

export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDocumentDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function lines(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => `<div>${escapeHtml(value)}</div>`)
    .join("");
}

function header(business: InvoiceBusinessSettingsDto, title: string, subtitleLines: Array<string | null>) {
  return `<div class="header"><div class="brand"><img class="logo" src="${styleCraftLogoDataUri}" alt="logo"><div><h1>${escapeHtml(business.businessName)}</h1><div class="muted">${lines([business.phone, business.email, business.address])}</div></div></div><div class="right"><h2>${escapeHtml(title)}</h2><div class="muted">${lines(subtitleLines)}</div></div></div>`;
}

function itemRows(items: InvoiceLineItemDto[], currencySymbol: string) {
  if (items.length === 0) {
    return `<tr><td colspan="7">No items on this invoice.</td></tr>`;
  }

  return items
    .map((item, index) => {
      const money = (cents: number) => escapeHtml(formatCurrency(cents, currencySymbol));

      return `<tr><td class="num">${index + 1}</td><td>${escapeHtml(item.productName)}<div class="muted">${escapeHtml(item.productSku)}</div></td><td>${escapeHtml(item.variantLabel)}</td><td class="num">${item.quantity}</td><td class="num">${money(item.unitPriceCents)}</td><td class="num">${money(item.discountAmountCents)}</td><td class="num">${money(item.totalAmountCents)}</td></tr>`;
    })
    .join("");
}

function itemsTable(items: InvoiceLineItemDto[], currencySymbol: string) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCents = items.reduce((sum, item) => sum + item.totalAmountCents, 0);

  return `<table><thead><tr><th class="num">#</th><th>Item</th><th>Size / colour</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Discount</th><th class="num">Amount</th></tr></thead><tbody>${itemRows(items, currencySymbol)}</tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${totalQuantity}</td><td class="num"></td><td class="num"></td><td class="num">${escapeHtml(formatCurrency(totalCents, currencySymbol))}</td></tr></tfoot></table>`;
}

function page(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${documentStyles}</style></head><body>${body}</body></html>`;
}

/** The single-sale invoice: who bought what, in which size, at what price. */
export function buildInvoiceHtml(invoice: InvoiceDetailDto) {
  const { currencySymbol } = invoice.business;
  const money = (cents: number) => escapeHtml(formatCurrency(cents, currencySymbol));
  const billTo = lines([invoice.customerName, invoice.customerPhone, invoice.customerEmail, invoice.customerAddress]) || "<div>Walk-in customer</div>";

  const body = `${header(invoice.business, `Invoice ${invoice.invoiceNumber}`, [`Date: ${formatDocumentDate(invoice.saleDate)}`, `Payment: ${invoice.paymentMethod ?? "-"}`])}
    <div class="boxes"><div class="box"><strong>Bill to</strong><div class="muted">${billTo}</div></div></div>
    ${itemsTable(invoice.items, currencySymbol)}
    <div class="totals"><div><span>Subtotal</span><span>${money(invoice.subtotalCents)}</span></div><div><span>Discount</span><span>${money(invoice.discountAmountCents)}</span></div><div class="total"><span>Total</span><span>${money(invoice.totalAmountCents)}</span></div></div>
    ${invoice.notes ? `<div class="box" style="margin-top:18px"><strong>Notes</strong><div class="muted">${escapeHtml(invoice.notes)}</div></div>` : ""}
    <div class="foot">Thank you for shopping with ${escapeHtml(invoice.business.businessName)}.</div>`;

  return page(`Invoice ${invoice.invoiceNumber}`, body);
}

function statementEntryRows(entries: StatementEntryDto[], currencySymbol: string) {
  if (entries.length === 0) {
    return `<tr><td colspan="6">No entries yet.</td></tr>`;
  }

  return entries
    .map((entry) => {
      const money = (cents: number) => (cents === 0 ? "-" : escapeHtml(formatCurrency(cents, currencySymbol)));

      return `<tr><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${escapeHtml(entryLabels[entry.kind])}</td><td>${escapeHtml(entry.reference)}</td><td class="num">${money(entry.debitCents)}</td><td class="num">${money(entry.creditCents)}</td><td class="num">${escapeHtml(formatCurrency(entry.balanceCents, currencySymbol))}</td></tr>`;
    })
    .join("");
}

/** The whole khata in one document: the running balance, then every sale's items underneath it. */
export function buildStatementHtml(statement: CustomerStatementDto) {
  const { currencySymbol } = statement.business;
  const money = (cents: number) => escapeHtml(formatCurrency(cents, currencySymbol));

  const saleSections = statement.entries
    .map((entry) => entry.sale)
    .filter((sale): sale is NonNullable<StatementEntryDto["sale"]> => sale !== null)
    .map(
      (sale) =>
        `<div class="sale"><div class="sale-head"><span>Invoice ${escapeHtml(sale.invoiceNumber)}</span><span>${escapeHtml(formatDocumentDate(sale.saleDate))}</span></div>${itemsTable(sale.items, currencySymbol)}<div class="totals"><div><span>Subtotal</span><span>${money(sale.subtotalCents)}</span></div><div><span>Discount</span><span>${money(sale.discountAmountCents)}</span></div><div class="total"><span>Invoice total</span><span>${money(sale.totalAmountCents)}</span></div></div></div>`,
    )
    .join("");

  const body = `${header(statement.business, "Account statement", [`Prepared: ${formatDocumentDate(statement.generatedAt)}`])}
    <div class="boxes">
      <div class="box"><strong>Customer</strong><div class="muted">${lines([statement.customerName, statement.customerPhone, statement.customerEmail, statement.customerAddress])}</div></div>
      <div class="box"><strong>Summary</strong><div class="muted"><div>Opening balance: ${money(statement.openingBalanceCents)}</div><div>Invoiced: ${money(statement.invoicedCents)}</div><div>Paid: ${money(statement.paidCents)}</div><div>Returned: ${money(statement.returnedCents)}</div></div></div>
    </div>
    <h3>Khata</h3>
    <table><thead><tr><th>Date</th><th>Entry</th><th>Reference</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>${statementEntryRows(statement.entries, currencySymbol)}</tbody></table>
    <div class="due"><span>${statement.balanceCents > 0 ? "Balance due" : "Balance"}</span><span>${money(statement.balanceCents)}</span></div>
    ${saleSections ? `<h3>Item details</h3>${saleSections}` : ""}
    <div class="foot">Thank you for shopping with ${escapeHtml(statement.business.businessName)}.</div>`;

  return page(`Statement ${statement.customerName}`, body);
}

export function invoiceDocumentFileName(invoice: InvoiceDetailDto) {
  return `${invoice.invoiceNumber} ${invoice.customerName ?? "Walk-in"}`;
}

export function statementDocumentFileName(statement: CustomerStatementDto) {
  return `Statement ${statement.customerName} ${formatDocumentDate(statement.generatedAt)}`;
}

/** Opens the document in a print window, for a paper copy or the browser's own Save as PDF. */
export function printDocumentHtml(html: string) {
  const printableWindow = window.open("", "_blank");

  if (printableWindow === null) {
    throw new Error("Could not open print window.");
  }

  printableWindow.document.write(html);
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.print();
}
