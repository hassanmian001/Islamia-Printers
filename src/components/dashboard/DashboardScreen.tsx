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
    { label: "Received this month", value: formatCurrency(summary.monthReceivedCents), detail: `Cash ${formatCurrency(summary.monthReceivedCashCents)} · Online ${formatCurrency(summary.monthReceivedOnlineCents)}`, icon: HandCoins },
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
        {metricCards(summary).map((card, index) => {
          const Icon = card.icon;
          // The first card (today's sales) is the hero: maroon, like the bill book header.
          const isHero = index === 0;

          return (
            <div
              className={
                isHero
                  ? "relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white shadow-brand"
                  : "rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              }
              key={card.label}
            >
              {isHero ? <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" /> : null}
              <span
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${isHero ? "bg-white/15 text-white" : "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className={`text-xs font-semibold uppercase tracking-wider ${isHero ? "text-white/75" : "text-slate-500 dark:text-slate-400"}`}>{card.label}</div>
              <div className={`mt-1 whitespace-nowrap text-xl font-extrabold tracking-tight 2xl:text-2xl ${isHero ? "text-white" : "text-slate-950 dark:text-slate-50"}`}>{card.value}</div>
              <div className={`mt-1 text-xs ${isHero ? "text-white/75" : "text-slate-500 dark:text-slate-400"}`}>{card.detail}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
            <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
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
                    <div className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-700" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
            <NotebookText className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
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
                    <td className="py-2 text-right font-semibold text-brand-700 dark:text-brand-300">{formatCurrency(row.balanceCents)}</td>
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
