import { BarChart3, CalendarDays, HandCoins, NotebookText, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorBanner, ScreenHeader } from "@/components/ui/form";
import { formatCurrency } from "@/lib/currency";
import { workKinds, workLabels } from "@/lib/job-math";
import type { DashboardSummaryDto } from "@/types/stylecraft-api";

function metricCards(summary: DashboardSummaryDto) {
  return [
    { label: "Today's sales", value: formatCurrency(summary.todaySalesCents), detail: `${summary.todayBillCount} bills today`, icon: BarChart3 },
    { label: "This month's sales", value: formatCurrency(summary.monthSalesCents), detail: `${summary.monthBillCount} bills this month`, icon: CalendarDays },
    { label: "Received this month", value: formatCurrency(summary.monthReceivedCents), detail: "Payments taken this month", icon: HandCoins },
    { label: "Total receivable", value: formatCurrency(summary.totalReceivableCents), detail: "Still to collect (wusooli baqi)", icon: Wallet },
    { label: "Customers", value: String(summary.customerCount), detail: "Accounts on the khata", icon: Users },
  ];
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      setIsLoading(true);
      setError(null);

      try {
        setSummary(await window.stylecraft.dashboard.getSummary());
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadSummary();
  }, []);

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-5 text-sm text-slate-500 dark:text-slate-400">Loading dashboard...</div>;
  }

  if (error) {
    return <ErrorBanner>{error}</ErrorBanner>;
  }

  if (summary === null) {
    return null;
  }

  const monthWorkTotal = workKinds.reduce((sum, kind) => sum + summary.monthWorkTotals[kind], 0);

  return (
    <div className="space-y-6">
      <ScreenHeader kicker="Islamia Printers" title="Dashboard">
        Today's and this month's sales, what came in, and who still owes the most.
      </ScreenHeader>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {metricCards(summary).map((card) => {
          const Icon = card.icon;

          return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5" key={card.label}>
              <Icon className="mb-3 h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <div className="text-sm text-slate-500 dark:text-slate-400">{card.label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-50">{card.value}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            This month by kind of work
          </h3>
          <ul className="mt-4 space-y-3">
            {workKinds.map((kind) => {
              const amount = summary.monthWorkTotals[kind];
              const share = monthWorkTotal === 0 ? 0 : Math.round((amount / monthWorkTotal) * 100);

              return (
                <li key={kind}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{workLabels[kind]}</span>
                    <span className="font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(amount)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
            <NotebookText className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Highest balances
          </h3>
          {summary.topReceivables.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nobody owes anything right now.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.topReceivables.map((row) => (
                  <tr key={row.customerId}>
                    <td className="py-2">
                      <div className="font-medium text-slate-950 dark:text-slate-50">{row.customerName}</div>
                      {row.phone ? <div className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</div> : null}
                    </td>
                    <td className="py-2 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(row.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
