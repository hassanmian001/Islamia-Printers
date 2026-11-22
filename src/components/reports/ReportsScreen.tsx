import { Download, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import CustomerPicker from "@/components/contacts/CustomerPicker";
import { Button } from "@/components/ui/button";
import { ErrorBanner, inputClass, labelClass, ScreenHeader } from "@/components/ui/form";
import WorkCell from "@/components/invoices/WorkCell";
import { formatCurrency } from "@/lib/currency";
import { firstDayOfMonthInputValue, formatAmount, formatAmountOrBlank, formatDate, formatQty, toDayInputValue } from "@/lib/format";
import { escapeHtml, printDocumentHtml } from "@/lib/invoice-document";
import { workKinds, workLabels } from "@/lib/job-math";
import type { ContactDto, ReportsDto } from "@/types/stylecraft-api";

function escapeCsvValue(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const plain = (cents: number) => (cents / 100).toFixed(2);

/** One line per job, with qty, rate and amount for each kind of work, so the sheet can be re-added in Excel. */
export function buildSalesCsv(report: ReportsDto) {
  const columns = [
    "Date",
    "Bill No",
    "Customer",
    "Job name",
    ...workKinds.flatMap((kind) => [`${workLabels[kind]} qty`, `${workLabels[kind]} rate`, `${workLabels[kind]} amount`]),
    "Grand Total",
  ];
  const rows = report.rows.map((row) => [
    formatDate(row.saleDate),
    row.billNumber,
    row.customerName,
    row.jobName,
    ...workKinds.flatMap((kind) => [row[kind].qty, plain(row[kind].rateCents), plain(row[kind].amountCents)]),
    plain(row.totalAmountCents),
  ]);
  const totals = ["", "", "", "Total", ...workKinds.flatMap((kind) => ["", "", plain(report.workTotals[kind])]), plain(report.salesTotalCents)];

  return [columns, ...rows, totals].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildReportHtml(report: ReportsDto, period: string) {
  const rows = report.rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(formatDate(row.saleDate))}</td><td>${row.billNumber}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.jobName)}</td>${workKinds
          .map((kind) =>
            row[kind].amountCents === 0
              ? "<td></td>"
              : `<td class="num">${escapeHtml(formatAmount(row[kind].amountCents))}<div class="sub">${escapeHtml(formatQty(row[kind].qty))} × ${escapeHtml(formatAmount(row[kind].rateCents))}</div></td>`,
          )
          .join("")}<td class="num">${escapeHtml(formatAmount(row.totalAmountCents))}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Sales report</title><style>
    @page{size:A4 landscape;margin:10mm}
    body{font-family:Arial,Helvetica,sans-serif;margin:12px;font-size:11px;color:#0f172a}
    table{border-collapse:collapse;width:100%;margin-top:10px}
    th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:top}
    th{background:#f1f5f9}.num{text-align:right;white-space:nowrap}.sub{font-size:10px;color:#64748b}
    tfoot td{font-weight:700;background:#e2e8f0}
  </style></head><body><h2>Sales report</h2><div>${escapeHtml(period)}</div>
  <table><thead><tr><th>Date</th><th>Bill</th><th>Customer</th><th>Job name</th>${workKinds.map((kind) => `<th class="num">${escapeHtml(workLabels[kind])}</th>`).join("")}<th class="num">Grand Total</th></tr></thead>
  <tbody>${rows}</tbody><tfoot><tr><td colspan="4">Total — ${report.billCount} bills, ${report.jobCount} jobs</td>${workKinds
    .map((kind) => `<td class="num">${escapeHtml(formatAmountOrBlank(report.workTotals[kind]))}</td>`)
    .join("")}<td class="num">${escapeHtml(formatAmount(report.salesTotalCents))}</td></tr></tfoot></table></body></html>`;
}

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState(() => firstDayOfMonthInputValue());
  const [endDate, setEndDate] = useState(() => toDayInputValue());
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [report, setReport] = useState<ReportsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setError(null);

    try {
      setReport(await window.stylecraft.reports.getReports({ startDate: startDate || null, endDate: endDate || null, customerId }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load the report.");
    }
  }, [startDate, endDate, customerId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    window.stylecraft.contacts
      .listCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  const period = `${startDate ? formatDate(new Date(`${startDate}T00:00:00`)) : "Beginning"} to ${endDate ? formatDate(new Date(`${endDate}T00:00:00`)) : "today"}`;

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Reports" title="Sales report">
        Every job sold in the period, what each kind of work earned, and how much was received. Export to Excel (CSV) or print.
      </ScreenHeader>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 md:grid-cols-4">
        <label className={labelClass} htmlFor="report-start">
          From date
          <input className={inputClass} id="report-start" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className={labelClass} htmlFor="report-end">
          To date
          <input className={inputClass} id="report-end" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
        <CustomerPicker allowAll customers={customers} id="report-customer" onChange={setCustomerId} value={customerId} />
        <div className="flex items-end gap-2">
          <Button
            className="gap-2"
            disabled={report === null || report.rows.length === 0}
            onClick={() => report && downloadCsv(`sales-report-${startDate || "all"}-to-${endDate || "today"}.csv`, buildSalesCsv(report))}
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Excel CSV
          </Button>
          <Button
            className="gap-2"
            disabled={report === null}
            onClick={() => {
              try {
                if (report) {
                  printDocumentHtml(buildReportHtml(report, period));
                }
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "Could not open the print window.");
              }
            }}
            type="button"
            variant="ghost"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      {report ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Sales" value={formatCurrency(report.salesTotalCents)} detail={`${report.billCount} bills · ${report.jobCount} jobs`} />
            <SummaryCard label="Received" value={formatCurrency(report.receivedCents)} detail="Payments in this period" />
            <SummaryCard label="Difference" value={formatCurrency(report.salesTotalCents - report.receivedCents)} detail="Sales minus received" />
            <SummaryCard label="Period" value={period} detail={customerId ? (customers.find((customer) => customer.id === customerId)?.name ?? "") : "All customers"} />
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {workKinds.map((kind) => (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4" key={kind}>
                <div className="text-sm text-slate-500 dark:text-slate-400">{workLabels[kind]}</div>
                <div className="mt-1 text-lg font-bold text-slate-950 dark:text-slate-50" data-testid={`work-total-${kind}`}>
                  {formatCurrency(report.workTotals[kind])}
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 font-semibold">Bill</th>
                  <th className="px-2 py-2 font-semibold">Customer</th>
                  <th className="px-2 py-2 font-semibold">Job name</th>
                  {workKinds.map((kind) => (
                    <th className="px-2 py-2 text-right font-semibold" key={kind}>
                      {workLabels[kind]}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-semibold">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-500 dark:text-slate-400" colSpan={10}>
                      No sales in this period.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, index) => (
                    <tr key={`${row.saleId}-${index}`}>
                      <td className="whitespace-nowrap px-2 py-2">{formatDate(row.saleDate)}</td>
                      <td className="px-2 py-2">{row.billNumber}</td>
                      <td className="px-2 py-2">{row.customerName}</td>
                      <td className="px-2 py-2 font-medium text-slate-950 dark:text-slate-50">{row.jobName}</td>
                      {workKinds.map((kind) => (
                        <WorkCell charge={row[kind]} key={kind} />
                      ))}
                      <td className="px-2 py-2 text-right font-semibold">{formatAmount(row.totalAmountCents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950 dark:text-slate-50">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{detail}</div>
    </div>
  );
}
