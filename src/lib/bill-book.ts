import { billBookBackgroundDataUri } from "@/lib/bill-book-background";
import { formatAmount, formatQty, formatRate } from "@/lib/format";
import { billLines, escapeHtml, paymentMethodLabel, type BillLine } from "@/lib/invoice-document";
import type { BillDocumentDto, QuotationDetailDto } from "@/types/stylecraft-api";

/**
 * The shop's bill book (Islamia Bill Book 2025.pdf), on A5.
 *
 * "full" prints the whole page — artwork and details — on plain paper.
 * "details" prints only the details, in black, into the boxes of an already
 * printed bill-book page; the offset nudges everything to suit the printer.
 */
export type BillPrintMode = "full" | "details";

export type BillPrintOptions = {
  mode?: BillPrintMode;
  /** Millimetres to move the details right (+) or left (-), for a pre-printed page. */
  offsetXMm?: number;
  /** Millimetres to move the details down (+) or up (-), for a pre-printed page. */
  offsetYMm?: number;
};

// Positions are measured off the design PDF in points (page-top coordinates);
// A5 (419.53 x 595.28 pt) is centred on its trim box, so this is its top-left corner.
const ORIGIN = { x: 306 - 419.53 / 2, y: 396 - 595.28 / 2 };
const mm = (pt: number) => (pt * 25.4) / 72;
const x = (pt: number) => mm(pt - ORIGIN.x);
const y = (pt: number) => mm(pt - ORIGIN.y);

const layout = {
  date: { left: 151, right: 229, line: 238.6 },
  sr: { left: 409, right: 488, line: 237.5 },
  name: { left: 160, right: 487, line: 260 },
  columns: {
    description: { left: 124, right: 333.3 },
    qty: { left: 333.3, right: 378.3 },
    rate: { left: 378.3, right: 423.2 },
    amount: { left: 423.2, right: 487.6 },
  },
  /** Item lines run from under the header to the top of the TOTAL box. */
  rows: { top: 290, bottom: 524 },
  totals: { total: 525.2, previous: 549.6, advance: 573.9, balance: 598.2, height: 24.3 },
  notes: { top: 560, bottom: 592 },
  /** Between the Date and Sr. fields, above their lines, for a word such as QUOTATION. */
  heading: { left: 236, right: 388, top: 222, height: 17 },
};

const ROW_PT = 15;
const MIN_ROW_PT = 9.5;

function box(leftPt: number, rightPt: number, topPt: number, heightPt: number, extra = "") {
  return `left:${x(leftPt).toFixed(2)}mm;top:${y(topPt).toFixed(2)}mm;width:${mm(rightPt - leftPt).toFixed(2)}mm;height:${mm(heightPt).toFixed(2)}mm;${extra}`;
}

function money(cents: number) {
  return `${formatAmount(cents)}/-`;
}

function billDate(value: Date) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

/** A field written on a ruled line: text sits just above the line. */
function onLine(field: { left: number; right: number; line: number }, text: string, cls: string) {
  return `<div class="f ${cls}" style="${box(field.left, field.right, field.line - 14, 13)}">${escapeHtml(text)}</div>`;
}

export function billBookFileSuffix(mode: BillPrintMode) {
  return mode === "details" ? " (details only)" : "";
}

/** What goes on a bill-book page, whatever the document. */
type BillBookPage = {
  documentTitle: string;
  /** Printed above the Date / Sr. line, e.g. "QUOTATION"; a bill has none. */
  heading?: string;
  date: Date;
  serial: string;
  name: string;
  lines: BillLine[];
  /** TOTAL, P. Bal, ADV. and BAL. values; null leaves the box empty. */
  totals: { total: string; previous: string | null; advance: string | null; balance: string | null };
  advanceNote?: string;
  notes?: string | null;
};

function partyName(name: string, phone: string | null) {
  return [name, phone ? `(${phone})` : null].filter(Boolean).join(" ");
}

/** The bill as an A5 page, ready to print or save as PDF. */
export function buildBillHtml(bill: BillDocumentDto, options: BillPrintOptions = {}) {
  return buildBillBookPage(
    {
      documentTitle: `Bill ${bill.billNumber}`,
      date: bill.saleDate,
      serial: String(bill.billNumber).padStart(3, "0"),
      name: partyName(bill.customerName, bill.customerPhone),
      lines: billLines(bill),
      totals: {
        total: money(bill.totalAmountCents),
        previous: money(bill.previousBalanceCents),
        advance: money(bill.advanceCents),
        balance: money(bill.closingBalanceCents),
      },
      advanceNote: bill.advanceCents > 0 && bill.advanceMethod === "online" ? paymentMethodLabel(bill.advanceMethod).toUpperCase() : "",
      notes: bill.notes,
    },
    options,
  );
}

/**
 * A quotation on the same bill-book page, headed QUOTATION, numbered Q-001.
 * Only TOTAL is filled: a quotation has no previous balance, advance or balance.
 */
export function buildQuotationHtml(quotation: QuotationDetailDto, options: BillPrintOptions = {}) {
  const validity = quotation.validUntil ? `Valid till ${billDate(quotation.validUntil)}` : null;

  return buildBillBookPage(
    {
      documentTitle: `Quotation Q-${quotation.quotationNumber}`,
      heading: "QUOTATION",
      date: quotation.quotationDate,
      serial: `Q-${String(quotation.quotationNumber).padStart(3, "0")}`,
      name: partyName(quotation.customerName, quotation.customerPhone),
      lines: billLines({ jobs: [], items: quotation.items }),
      totals: { total: money(quotation.totalAmountCents), previous: null, advance: null, balance: null },
      notes: [validity, quotation.notes].filter(Boolean).join(" · ") || null,
    },
    options,
  );
}

function buildBillBookPage(page: BillBookPage, options: BillPrintOptions) {
  const mode = options.mode ?? "full";
  const offsetX = mode === "details" ? (options.offsetXMm ?? 0) : 0;
  const offsetY = mode === "details" ? (options.offsetYMm ?? 0) : 0;
  const lines = page.lines;
  const { columns, rows, totals } = layout;

  // Shrink the rows when there are many lines, so the amounts never run into the TOTAL box.
  const available = rows.bottom - rows.top;
  const rowPt = Math.max(MIN_ROW_PT, Math.min(ROW_PT, available / Math.max(lines.length, 1)));
  const fontPt = Math.min(9.5, rowPt * 0.66);

  const itemRows = lines
    .map((line, index) => {
      const top = rows.top + index * rowPt;
      const cls = line.kind === "head" ? "head" : line.kind === "sub" ? "sub" : "";
      const cell = (col: { left: number; right: number }, text: string, align: string) =>
        `<div class="f row ${cls} ${align}" style="${box(col.left + 4, col.right - 4, top, rowPt, `font-size:${fontPt.toFixed(2)}pt;line-height:${mm(rowPt).toFixed(2)}mm;`)}">${text}</div>`;

      return [
        cell(columns.description, escapeHtml(line.kind === "sub" ? `   ${line.description}` : line.description), "l"),
        line.qty === null ? "" : cell(columns.qty, escapeHtml(formatQty(line.qty)), "c"),
        line.rateCents === null ? "" : cell(columns.rate, escapeHtml(formatRate(line.rateCents)), "c"),
        line.amountCents === null ? "" : cell(columns.amount, escapeHtml(money(line.amountCents)), "c"),
      ].join("");
    })
    .join("");

  const totalCell = (topPt: number, value: string | null, note = "") =>
    value === null
      ? ""
      : `<div class="f total" style="${box(columns.amount.left, columns.amount.right, topPt, totals.height)}"><span>${escapeHtml(value)}</span>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`;

  const details = `
    ${page.heading ? `<div class="f heading" style="${box(layout.heading.left, layout.heading.right, layout.heading.top, layout.heading.height)}">${escapeHtml(page.heading)}</div>` : ""}
    ${onLine(layout.date, billDate(page.date), "c")}
    ${onLine(layout.sr, page.serial, "c")}
    ${onLine(layout.name, page.name, "l name")}
    ${itemRows}
    ${totalCell(totals.total, page.totals.total)}
    ${totalCell(totals.previous, page.totals.previous)}
    ${totalCell(totals.advance, page.totals.advance, page.advanceNote ?? "")}
    ${totalCell(totals.balance, page.totals.balance)}
    ${page.notes && lines.length * rowPt < layout.notes.top - rows.top ? `<div class="f notes" style="${box(columns.description.left + 4, columns.description.right - 4, layout.notes.top, layout.notes.bottom - layout.notes.top)}">${escapeHtml(page.notes)}</div>` : ""}`;

  const ink = mode === "details" ? "#000" : "#1f2937";
  const styles = `
    @page{size:148mm 210mm;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;overflow:hidden}
    body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:${ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{position:relative;width:148mm;height:210mm;overflow:hidden;page-break-after:avoid;background:#fff}
    .bg{position:absolute;inset:0;width:148mm;height:210mm}
    .layer{position:absolute;inset:0;transform:translate(${offsetX}mm,${offsetY}mm)}
    .f{position:absolute;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .f.c{text-align:center}.f.l{text-align:left}
    .f.name,.f.c{font-size:10.5pt;font-weight:600;line-height:${mm(13).toFixed(2)}mm}
    .f.row{font-weight:500}
    .f.row.head{font-weight:700}
    .f.row.sub{color:${mode === "details" ? "#000" : "#4b5563"}}
    .f.total{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10.5pt;font-weight:700;line-height:1.1}
    .f.total small{font-size:6.5pt;font-weight:600;letter-spacing:.06em}
    .f.notes{white-space:normal;font-size:8pt;font-style:italic}
    .f.heading{text-align:center;font-size:13pt;font-weight:800;letter-spacing:.32em;color:${mode === "details" ? "#000" : "#991f36"};line-height:${mm(layout.heading.height).toFixed(2)}mm}
  `;

  const body = `<div class="page">${mode === "full" ? `<img class="bg" src="${billBookBackgroundDataUri}" alt="">` : ""}<div class="layer">${details}</div></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(page.documentTitle)}</title><style>${styles}</style></head><body>${body}</body></html>`;
}
