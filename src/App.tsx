import { BarChart3, Banknote, ClipboardList, FileText, HandCoins, LayoutDashboard, Moon, NotebookText, Settings, ShoppingCart, Sun, Users } from "lucide-react";
import { useState, type ComponentType } from "react";

import { sections, type IconName, type SectionId } from "@/app-content";
import ContactsScreen from "@/components/contacts/ContactsScreen";
import DashboardScreen from "@/components/dashboard/DashboardScreen";
import LedgerScreen from "@/components/ledger/LedgerScreen";
import PaymentsScreen from "@/components/payments/PaymentsScreen";
import QuotationScreen from "@/components/quotations/QuotationScreen";
import ReportsScreen from "@/components/reports/ReportsScreen";
import CashSaleScreen from "@/components/sales/CashSaleScreen";
import SalesScreen from "@/components/sales/SalesScreen";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { brandLogoWhiteDataUri } from "@/lib/branding";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

const icons = {
  chart: BarChart3,
  contacts: Users,
  dashboard: LayoutDashboard,
  cash: Banknote,
  ledger: NotebookText,
  payments: HandCoins,
  quotation: ClipboardList,
  reports: FileText,
  sales: ShoppingCart,
  settings: Settings,
} satisfies Record<IconName, typeof LayoutDashboard>;

const screens: Record<SectionId, ComponentType> = {
  dashboard: DashboardScreen,
  sales: SalesScreen,
  cash: CashSaleScreen,
  quotation: QuotationScreen,
  payments: PaymentsScreen,
  ledger: LedgerScreen,
  contacts: ContactsScreen,
  reports: ReportsScreen,
  settings: SettingsScreen,
};

const todayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function App() {
  const [activeSectionId, setActiveSectionId] = useState<SectionId>("dashboard");
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const ActiveIcon = icons[activeSection.icon];
  const Screen = screens[activeSection.id];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="relative overflow-hidden bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col dark:from-brand-900 dark:via-brand-950 dark:to-black">
          {/* Soft light in the corner and a faint oversized mark, for depth without noise. */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <img alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-12 w-56 opacity-[0.06]" src={brandLogoWhiteDataUri} />

          <div className="relative px-5 pb-5 pt-6">
            <div className="flex items-center gap-3">
              <img alt="Islamia Printers logo" className="h-12 w-12 drop-shadow" src={brandLogoWhiteDataUri} />
              <div className="leading-none">
                <div className="text-xl font-extrabold tracking-[0.14em]">ISLAMIA</div>
                <div className="mt-1 text-[11px] font-medium tracking-[0.42em] text-white/70">PRINTERS</div>
              </div>
            </div>
            <div className="mt-5 h-px bg-gradient-to-r from-white/40 via-white/15 to-transparent" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Sales &amp; Khata</p>
          </div>

          <nav aria-label="Main navigation" className="relative grid gap-1 px-3 md:flex-1 md:content-start md:overflow-y-auto">
            {sections.map((section) => {
              const Icon = icons[section.icon];
              const isActive = activeSectionId === section.id;

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all",
                    isActive ? "bg-white text-brand-700 shadow-lg shadow-black/20" : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-brand-50 text-brand-600" : "bg-white/10 text-white group-hover:bg-white/15",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {section.label}
                </button>
              );
            })}
          </nav>

          <div className="relative border-t border-white/10 px-3 py-4">
            <button
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              onClick={toggleTheme}
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </span>
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-100/85 px-4 py-3 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/85">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-brand">
                  <ActiveIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Islamia Printers</div>
                  <div className="text-base font-bold text-slate-950 dark:text-slate-50">{activeSection.label}</div>
                </div>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm sm:block dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {todayLabel.format(new Date())}
              </div>
            </div>
          </header>

          <section className="mx-auto max-w-7xl p-4 md:p-8">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card md:p-7 dark:border-slate-800 dark:bg-slate-900">
              <Screen />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
