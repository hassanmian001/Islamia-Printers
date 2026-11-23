import type { ReactNode } from "react";

export const inputClass =
  "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm transition-colors text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/50";

export const compactInputClass =
  "w-full min-w-0 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-right text-sm text-slate-950 dark:text-slate-50 outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/50";

/** The compact input for text, such as a job name or description: same look, left-aligned. */
export const compactTextInputClass = compactInputClass.replace("text-right", "text-left");

export const labelClass = "grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200";

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">
      {children}
    </div>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm font-medium text-green-800 dark:text-green-300" role="status">
      {children}
    </div>
  );
}

export function ScreenHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
        <span className="h-1 w-6 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
        {kicker}
      </p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">{title}</h2>
      {children ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</p> : null}
    </div>
  );
}
