import { brandLogoDataUri } from "@/lib/branding";
import { formatCurrency } from "@/lib/currency";
import { formatAmount, formatAmountOrBlank, formatDate, formatQty, formatRate } from "@/lib/format";
import { workKinds, workLabels } from "@/lib/job-math";
import type { BillDocumentDto, BusinessDocumentSettingsDto, LedgerStatementDto, PaymentMethod, SaleKind, WorkAmounts, WorkCharge } from "@/types/stylecraft-api";

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

const maroon = "#991F36";

const billStyles = `
  @page{size:A4 portrait;margin:10mm}
  body{margin:0;font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#1f2937}
  .sheet{position:relative;padding:18px 22px 10px}
  .topbar{position:absolute;top:10px;right:22px;width:38%;height:7px;background:#c7c8ca}
  .brand{display:flex;align-items:flex-end;gap:10px;margin-top:6px}
  .brand img{width:66px;height:66px;object-fit:contain}
  .brand .islamia{font-size:50px;line-height:1;font-weight:800;letter-spacing:5px;color:${maroon}}
  .brand .printers{font-size:38px;line-height:1;font-weight:500;letter-spacing:5px;color:#58595b;margin-left:6px}
  .rule{height:2px;background:${maroon};margin:8px 0 6px}
  .contact{text-align:center;font-size:12px;color:#374151;line-height:1.6}
  .contact .dot{color:${maroon};font-weight:700;margin:0 4px}
  .rule2{height:1px;background:${maroon};margin:6px 0 16px}
  .meta{display:flex;justify-content:space-between;align-items:flex-end;margin:10px 0;font-size:17px}
  .meta .label{color:${maroon};font-weight:600}
  .meta .fill{display:inline-block;border-bottom:1.5px solid ${maroon};min-width:150px;padding:0 10px 2px;font-weight:600;color:#111827;text-align:center}
  .meta .fill.wide{min-width:0;flex:1;text-align:left}
  .meta .name{display:flex;flex:1;gap:6px;align-items:flex-end}
  table.bill{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed;position:relative}
  table.bill th{background:${maroon};color:#fff;font-weight:600;letter-spacing:1px;padding:9px 6px;font-size:14px;border:1px solid ${maroon};text-align:center}
  table.bill td{border:none;border-left:1px solid ${maroon};border-right:1px solid ${maroon};padding:5px 10px;font-size:14px;vertical-align:top}
  table.bill td .m{font-size:10px;font-weight:500;color:#6b7280;letter-spacing:.5px}
  table.bill td.c{text-align:center}
  table.bill tr.head td{font-weight:700;padding-top:9px}
  table.bill tr.sub td.d{padding-left:26px;color:#374151}
  table.bill tr.filler td{border-bottom:1px solid ${maroon}}
  table.bill tr.tot td{border:1px solid ${maroon};padding:7px 10px;font-size:15px}
  table.bill tr.tot td.blank{border:none;border-left:1px solid ${maroon};border-right:1px solid ${maroon}}
  table.bill tr.tot:last-child td.blank{border-bottom:1px solid ${maroon}}
  table.bill tr.tot td.lbl{background:${maroon};color:#fff;font-weight:600;text-align:center;letter-spacing:1px}
  table.bill tr.tot td.val{text-align:center;font-weight:600}
  .watermark{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:260px;opacity:.05;pointer-events:none}
  .notes{margin-top:10px;font-size:13px;color:#374151}
  .sign{display:flex;justify-content:flex-end;margin-top:46px}
  .sign div{width:200px;border-top:1.5px solid ${maroon};text-align:center;color:${maroon};font-size:16px;padding-top:4px}
  .bottombar{height:5px;background:#c7c8ca;margin-top:18px}
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
  return `<div class="header"><div class="brand"><img class="logo" src="${brandLogoDataUri}" alt="logo"><div><h1>${escapeHtml(business.businessName)}</h1><div class="muted">${lines([business.address, ...contactPieces(business.phone), business.email])}</div></div></div><div class="right"><h2>${escapeHtml(title)}</h2><div class="muted">${lines(subtitleLines)}</div></div></div>`;
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

/** "15 SV" for a job bill, "16 CS" for a cash sale, as the V/No on the khata. */
export function billNumberLabel(billNumber: number, kind: SaleKind = "job") {
  return `${billNumber} ${kind === "cash" ? "CS" : "SV"}`;
}

export function receiptNumberLabel(receiptNumber: number) {
  return `${receiptNumber} CR`;
}

export function paymentMethodLabel(method: PaymentMethod) {
  return method === "online" ? "Online" : "Cash";
}

/** What a payment line on the khata says: whether it was a bill's advance, cash or online, and the detail typed. */
export function paymentNarration(payment: { method: PaymentMethod; narration: string | null; billNumber: number | null }) {
  return [payment.billNumber !== null ? `Advance (Bill ${payment.billNumber})` : null, paymentMethodLabel(payment.method), payment.narration]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" · ");
}

/** One printed line of a bill: Description, Qty, Rate, Amount. Headers name a job whose charges follow underneath. */
export type BillLine = {
  kind: "head" | "line" | "sub";
  description: string;
  qty: number | null;
  rateCents: number | null;
  amountCents: number | null;
};

/**
 * Flattens a bill into Description / Qty / Rate / Amount lines. A cash sale
 * prints its lines as they are. A job charged for one kind of work prints as one
 * line ("Visiting cards — Rota P"); a job with several prints its name, then
 * one line per kind of work.
 */
export function billLines(bill: Pick<BillDocumentDto, "jobs" | "items">): BillLine[] {
  const lines: BillLine[] = bill.items.map((item) => ({ kind: "line", description: item.description, qty: item.qty, rateCents: item.rateCents, amountCents: item.amountCents }));

  for (const job of bill.jobs) {
    const charged = workKinds.filter((kind) => job[kind].amountCents !== 0 || job[kind].qty !== 0);

    if (charged.length === 1) {
      const charge = job[charged[0]];
      lines.push({ kind: "line", description: `${job.jobName} — ${workLabels[charged[0]]}`, qty: charge.qty, rateCents: charge.rateCents, amountCents: charge.amountCents });
      continue;
    }

    lines.push({ kind: "head", description: job.jobName, qty: null, rateCents: null, amountCents: null });

    for (const kind of charged) {
      lines.push({ kind: "sub", description: workLabels[kind], qty: job[kind].qty, rateCents: job[kind].rateCents, amountCents: job[kind].amountCents });
    }
  }

  return lines;
}

/** Bill money as printed: 13,000/- */
export function billMoney(cents: number) {
  return `${formatAmount(cents)}/-`;
}

function billDate(value: Date) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

/** The shop's contacts, one per piece: "Name | number; Name | number" in Settings becomes two. */
function contactPieces(value: string | null) {
  return (value ?? "")
    .split(";")
    .map((piece) => piece.trim())
    .filter((piece) => piece !== "");
}

/**
 * A single bill laid out like the shop's printed bill book: logo and name,
 * address and contacts, Date / Sr. / Name, a Description / Qty / Rate / Amount
 * table running down the page, Total / Adv. / Bal., and a signature line.
 */
export function buildBillHtml(bill: BillDocumentDto) {
  const lines = billLines(bill);
  const rows = lines
    .map((line) => {
      const qty = line.qty === null ? "" : escapeHtml(formatQty(line.qty));
      const rate = line.rateCents === null ? "" : escapeHtml(formatRate(line.rateCents));
      const amount = line.amountCents === null ? "" : escapeHtml(billMoney(line.amountCents));
      const css = line.kind === "head" ? "head" : line.kind === "sub" ? "sub" : "";

      return `<tr class="${css}"><td class="d">${escapeHtml(line.description)}</td><td class="c">${qty}</td><td class="c">${rate}</td><td class="c">${amount}</td></tr>`;
    })
    .join("");
  const fillerHeight = Math.max(60, 470 - lines.length * 30);
  const name = [bill.customerName, bill.customerPhone ? `(${bill.customerPhone})` : null].filter(Boolean).join(" ");
  const contacts = contactPieces(bill.business.phone);
  const addressLine = [bill.business.address, bill.business.email].filter((part): part is string => !!part);
  // "Islamia Printers": the first word in maroon, the rest in grey, as on the printed bill book.
  const [firstWord = "", ...otherWords] = bill.business.businessName.trim().toUpperCase().split(/\s+/);

  const body = `<div class="sheet">
    <div class="topbar"></div>
    <div class="brand"><img src="${brandLogoDataUri}" alt="logo"><span class="islamia">${escapeHtml(firstWord)}</span><span class="printers">${escapeHtml(otherWords.join(" "))}</span></div>
    <div class="rule"></div>
    ${addressLine.length > 0 ? `<div class="contact">${addressLine.map(escapeHtml).join('<span class="dot">•</span>')}</div>` : ""}
    ${contacts.length > 0 ? `<div class="contact">${contacts.map(escapeHtml).join('<span class="dot">|</span>')}</div>` : ""}
    <div class="rule2"></div>
    <div class="meta"><span><span class="label">Date:</span> <span class="fill">${escapeHtml(billDate(bill.saleDate))}</span></span><span><span class="label">Sr.</span> <span class="fill">${escapeHtml(String(bill.billNumber).padStart(3, "0"))}</span></span></div>
    <div class="meta"><span class="name"><span class="label">Name:</span> <span class="fill wide">${escapeHtml(name)}</span></span></div>
    <table class="bill">
      <colgroup><col style="width:56%"><col style="width:12%"><col style="width:12%"><col style="width:20%"></colgroup>
      <thead><tr><th>DESCRIPTION</th><th>QTY.</th><th>RATE</th><th>AMOUNT</th></tr></thead>
      <tbody>${rows}<tr class="filler"><td style="height:${fillerHeight}px"></td><td></td><td></td><td></td></tr>
        <tr class="tot"><td class="blank" colspan="2"></td><td class="lbl">TOTAL</td><td class="val">${escapeHtml(billMoney(bill.totalAmountCents))}</td></tr>
        <tr class="tot"><td class="blank" colspan="2"></td><td class="lbl">ADV.</td><td class="val">${escapeHtml(billMoney(bill.advanceCents))}${bill.advanceCents > 0 && bill.advanceMethod ? `<div class="m">${escapeHtml(paymentMethodLabel(bill.advanceMethod).toUpperCase())}</div>` : ""}</td></tr>
        <tr class="tot"><td class="blank" colspan="2"></td><td class="lbl">BAL.</td><td class="val">${escapeHtml(billMoney(bill.balanceCents))}</td></tr>
      </tbody>
    </table>
    <img class="watermark" src="${brandLogoDataUri}" alt="">
    ${bill.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(bill.notes)}</div>` : ""}
    <div class="sign"><div>Signature</div></div>
    <div class="bottombar"></div>
  </div>`;

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
        return `<tr class="payment"><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${escapeHtml(receiptNumberLabel(entry.receiptNumber))}</td><td>${escapeHtml(paymentNarration(entry))}</td>${workKinds.map(() => "<td></td>").join("")}<td></td><td class="num">${money(entry.amountCents)}</td><td class="num">${money(entry.balanceCents)}</td></tr>`;
      }

      const vNo = escapeHtml(billNumberLabel(entry.billNumber, entry.saleKind));
      const itemRows = entry.items
        .map(
          (item) =>
            `<tr><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${vNo}</td><td>${escapeHtml(item.description)}<div class="sub">${escapeHtml(formatQty(item.qty))} × ${escapeHtml(formatRate(item.rateCents))}</div></td>${workKinds.map(() => "<td></td>").join("")}<td class="num">${money(item.amountCents)}</td><td></td><td class="num">${money(item.balanceCents)}</td></tr>`,
        )
        .join("");
      const jobRows = itemRows + entry.jobs
        .map(
          (job) =>
            `<tr><td>${escapeHtml(formatDocumentDate(entry.date))}</td><td>${vNo}</td><td>${escapeHtml(job.jobName)}</td>${workKinds.map((kind) => workCell(job[kind])).join("")}<td class="num">${money(job.totalAmountCents)}</td><td></td><td class="num">${money(job.balanceCents)}</td></tr>`,
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
