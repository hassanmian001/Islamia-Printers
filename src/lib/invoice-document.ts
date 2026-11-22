import { styleCraftLogoDataUri } from "@/lib/branding";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, formatAmountOrBlank, formatDate, formatQty, formatRate } from "@/lib/format";
import { workKinds, workLabels } from "@/lib/job-math";
import type { BillDocumentDto, BusinessDocumentSettingsDto, LedgerStatementDto, WorkAmounts, WorkCharge } from "@/types/stylecraft-api";

const baseStyles = `
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#0f172a;font-size:12px}
  h1{font-size:20px;margin:0}
  h2{font-size:17px;margin:0}
  .header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #0f172a}
  .brand{display:flex;align-items:center;gap:12px}
  .logo{width:52px;height:52px;object-fit:contain}
  .muted{color:#475569;font-size:11px}
  .right{text-align:right}
  table{border-collapse:collapse;width:100%;margin-top:10px}
  th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;font-size:11px}
  td.num,th.num{text-align:right;white-space:nowrap}
  .sub{font-size:10px;color:#64748b;white-space:nowrap}
  .foot{margin-top:22px;font-size:10px;color:#64748b;display:flex;justify-content:space-between}
`;

const ledgerStyles = `
  @page{size:A4 landscape;margin:10mm}
  body{margin:12px;font-size:11px}
  .period{margin-top:6px;font-size:12px}
  .account{margin-top:10px;border:1px solid #0f172a;padding:6px 10px;font-size:14px;font-weight:700;font-style:italic}
  table{font-size:11px}
  th.c-date{width:74px}th.c-vno{width:62px}th.c-job{width:20%}
  tr.subtotal td{font-weight:700;background:#f8fafc}
  tr.subtotal td.label{text-align:right}
  tr.grand td{font-weight:700;border-top:2px solid #0f172a;background:#e2e8f0}
  tr.opening td,tr.payment td{background:#fff}
  .final{margin-top:14px;display:flex;justify-content:flex-end;gap:40px;font-size:14px;font-weight:700}
  .signatures{margin-top:56px;display:flex;justify-content:space-between}
  .signatures div{border-top:1px solid #0f172a;padding-top:4px;width:160px;text-align:center;font-weight:700}
`;

const billStyles = `
  .boxes{display:flex;gap:16px;margin-top:14px}
  .box{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:10px}
  .box strong{display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#334155}
  tfoot td{font-weight:700;background:#f8fafc}
  .total{margin-left:auto;margin-top:12px;width:280px;display:flex;justify-content:space-between;border:2px solid #0f172a;border-radius:8px;padding:8px 10px;font-size:15px;font-weight:700}
`;

export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDocumentDate(value: Date | string) {
  return formatDate(value);
}

function lines(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => `<div>${escapeHtml(value)}</div>`)
    .join("");
}

function header(business: BusinessDocumentSettingsDto, title: string, subtitleLines: Array<string | null>) {
  return `<div class="header"><div class="brand"><img class="logo" src="${styleCraftLogoDataUri}" alt="logo"><div><h1>${escapeHtml(business.businessName)}</h1><div class="muted">${lines([business.address, business.phone, business.email])}</div></div></div><div class="right"><h2>${escapeHtml(title)}</h2><div class="muted">${lines(subtitleLines)}</div></div></div>`;
}

function page(title: string, styles: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${baseStyles}${styles}</style></head><body>${body}</body></html>`;
}

/** One kind of work in a cell: the amount, with "qty x rate" underneath so the figure can be checked. */
function workCell(charge: WorkCharge) {
  if (charge.amountCents === 0 && charge.qty === 0) {
    return `<td class="num"></td>`;
  }

  return `<td class="num">${escapeHtml(formatAmountOrBlank(charge.amountCents))}<div class="sub">${escapeHtml(formatQty(charge.qty))} × ${escapeHtml(formatRate(charge.rateCents))}</div></td>`;
}

function workTotalCells(totals: WorkAmounts) {
  return workKinds.map((kind) => `<td class="num">${escapeHtml(formatAmountOrBlank(totals[kind]))}</td>`).join("");
}

const workHeaders = workKinds.map((kind) => `<th class="num">${escapeHtml(workLabels[kind])}</th>`).join("");

export function billNumberLabel(billNumber: number) {
  return `${billNumber} SV`;
}

export function receiptNumberLabel(receiptNumber: number) {
  return `${receiptNumber} CR`;
}

/** A single bill: the shop, the customer, every job with each kind of work as qty x rate, and the bill total. */
export function buildBillHtml(bill: BillDocumentDto) {
  const { currencySymbol } = bill.business;
  const rows = bill.jobs
    .map(
      (job, index) =>
        `<tr><td class="num">${index + 1}</td><td>${escapeHtml(job.jobName)}</td>${workKinds.map((kind) => workCell(job[kind])).join("")}<td class="num"><strong>${escapeHtml(formatAmount(job.totalAmountCents))}</strong></td></tr>`,
    )
    .join("");
  const totals = Object.fromEntries(workKinds.map((kind) => [kind, bill.jobs.reduce((sum, job) => sum + job[kind].amountCents, 0)])) as WorkAmounts;

  const body = `${header(bill.business, `Bill No. ${bill.billNumber}`, [`Date: ${formatDocumentDate(bill.saleDate)}`])}
    <div class="boxes"><div class="box"><strong>Bill to</strong><div class="muted">${lines([bill.customerName, bill.customerPhone, bill.customerAddress])}</div></div></div>
    <table><thead><tr><th class="num">#</th><th>Job name</th>${workHeaders}<th class="num">Grand Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2">Total</td>${workTotalCells(totals)}<td class="num">${escapeHtml(formatAmount(bill.totalAmountCents))}</td></tr></tfoot></table>
    <div class="total"><span>Bill total</span><span>${escapeHtml(formatCurrency(bill.totalAmountCents, currencySymbol))}</span></div>
    ${bill.notes ? `<div class="box" style="margin-top:14px"><strong>Notes</strong><div class="muted">${escapeHtml(bill.notes)}</div></div>` : ""}
    <div class="foot"><span>Thank you for your business — ${escapeHtml(bill.business.businessName)}</span><span>Printed ${escapeHtml(formatDocumentDate(new Date()))}</span></div>`;

  return page(`Bill ${bill.billNumber}`, billStyles, body);
}

function dayBefore(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date;
}

function periodLabel(statement: LedgerStatementDto) {
  const from = statement.startDate ? formatDocumentDate(new Date(`${statement.startDate}T00:00:00`)) : "Beginning";
  const to = statement.endDate ? formatDocumentDate(new Date(`${statement.endDate}T00:00:00`)) : formatDocumentDate(statement.generatedAt);

  return { from, to };
}

/**
 * The customer's statement of account, laid out like a paper khata: opening
 * balance, then each bill job by job closed by a sub-total, payments in between,
 * a grand total and the final balance.
 */
export function buildLedgerHtml(statement: LedgerStatementDto) {
  const money = (cents: number) => escapeHtml(formatAmount(cents));
  const blank = (cents: number) => escapeHtml(formatAmountOrBlank(cents));
  const { from, to } = periodLabel(statement);
  const columnCount = 3 + workKinds.length + 3;

  const openingDate = statement.startDate ? formatDocumentDate(dayBefore(statement.startDate)) : "";
  const openingRow = `<tr class="opening"><td>${escapeHtml(openingDate)}</td><td>OB</td><td>********** Opening Balance **********</td>${workKinds.map(() => "<td></td>").join("")}<td></td><td></td><td class="num">${money(statement.openingBalanceCents)}</td></tr>`;

  const entryRows = statement.entries
    .map((entry) => {
      if (entry.kind === "payment") {
        return `<tr class="payment"><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${escapeHtml(receiptNumberLabel(entry.receiptNumber))}</td><td>${escapeHtml(entry.narration ?? "Payment received")}</td>${workKinds.map(() => "<td></td>").join("")}<td></td><td class="num">${money(entry.amountCents)}</td><td class="num">${money(entry.balanceCents)}</td></tr>`;
      }

      const jobRows = entry.jobs
        .map(
          (job) =>
            `<tr><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${escapeHtml(billNumberLabel(entry.billNumber))}</td><td>${escapeHtml(job.jobName)}</td>${workKinds.map((kind) => workCell(job[kind])).join("")}<td class="num">${money(job.totalAmountCents)}</td><td></td><td class="num">${money(job.balanceCents)}</td></tr>`,
        )
        .join("");

      return `${jobRows}<tr class="subtotal"><td class="label" colspan="3">Sub-Total &gt;&gt;&gt;&gt;&gt;</td>${workTotalCells(entry.workTotals)}<td class="num">${money(entry.totalAmountCents)}</td><td></td><td class="num">${money(entry.balanceCents)}</td></tr>`;
    })
    .join("");

  const emptyRow = statement.entries.length === 0 ? `<tr><td colspan="${columnCount}">No bills or payments in this period.</td></tr>` : "";
  const grandRow = `<tr class="grand"><td colspan="3">Grand Total</td>${workTotalCells(statement.workTotals)}<td class="num">${blank(statement.debitCents)}</td><td class="num">${blank(statement.creditCents)}</td><td class="num">${money(statement.closingBalanceCents)}</td></tr>`;

  const body = `${header(statement.business, "Statement of Account", [])}
    <div class="period"><strong>From Date:</strong> ${escapeHtml(from)} &nbsp;&nbsp; <strong>To Date:</strong> ${escapeHtml(to)}</div>
    <div class="account">A/C No. ${escapeHtml(statement.customer.id)} &nbsp;&nbsp;&nbsp; A/C Title : ${escapeHtml(statement.customer.name)} ${escapeHtml(statement.customer.phone ?? "")}</div>
    <table><thead><tr><th class="c-date">Date</th><th class="c-vno">V/NO</th><th class="c-job">Job Name / Narration</th>${workHeaders}<th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody>${openingRow}${entryRows}${emptyRow}${grandRow}</tbody></table>
    <div class="final"><span>Final Balance &gt;&gt;&gt;&gt;&gt; :</span><span>${money(statement.closingBalanceCents)}</span></div>
    <div class="signatures"><div>Prepared by</div><div>Checked by</div><div>Received by</div></div>
    <div class="foot"><span>Date &amp; Time : ${escapeHtml(new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(statement.generatedAt)))}</span><span>${escapeHtml(statement.business.businessName)}</span></div>`;

  return page(`Ledger ${statement.customer.name}`, ledgerStyles, body);
}

export function billDocumentFileName(bill: BillDocumentDto) {
  return `Bill ${bill.billNumber} ${bill.customerName}`;
}

export function ledgerDocumentFileName(statement: LedgerStatementDto) {
  const { from, to } = periodLabel(statement);

  return `Ledger ${statement.customer.name} ${from} to ${to}`.replaceAll("/", "-");
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
