import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { printDocumentHtml } from "@/lib/invoice-document";

type DocumentPanelProps = {
  /** Small line above the heading, e.g. "Invoice" or "Account statement". */
  kicker: string;
  title: string;
  subtitle?: string;
  /** The printable document, already built. Saved as PDF and printed as-is. */
  html: string;
  /** Base name for the saved file; the main process makes it safe and adds ".pdf". */
  fileName: string;
  /** Wide documents such as the khata are saved sideways. */
  landscape?: boolean;
  pageSize?: "A4" | "A5";
  /** Extra controls shown beside the buttons, such as a print mode switch. */
  toolbar?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export default function DocumentPanel({ kicker, title, subtitle, html, fileName, landscape = false, pageSize = "A4", toolbar, onClose, children }: DocumentPanelProps) {
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePdf(saveAs: boolean) {
    setError(null);
    setSavedFilePath(null);
    setIsSaving(true);

    try {
      const result = await window.stylecraft.invoices.savePdf({ html, fileName, saveAs, landscape, pageSize });
      setSavedFilePath(result.filePath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the PDF.");
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    setError(null);

    try {
      printDocumentHtml(html);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open the print window.");
    }
  }

  return (
    <section aria-label={`${kicker} preview`} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{kicker}</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isSaving} onClick={() => void savePdf(false)} size="sm" type="button">
            {isSaving ? "Saving..." : "Download PDF"}
          </Button>
          <Button disabled={isSaving} onClick={() => void savePdf(true)} size="sm" type="button" variant="ghost">
            Save as...
          </Button>
          <Button onClick={handlePrint} size="sm" type="button" variant="ghost">
            Print
          </Button>
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            Close
          </Button>
        </div>
      </div>

      {toolbar ? <div className="mt-4">{toolbar}</div> : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">
          {error}
        </div>
      ) : null}

      {savedFilePath ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300" role="status">
          <span>Saved to {savedFilePath}</span>
          <Button onClick={() => void window.stylecraft.invoices.reveal(savedFilePath)} size="sm" type="button" variant="ghost">
            Open folder
          </Button>
        </div>
      ) : null}

      <div className="mt-4">{children}</div>
    </section>
  );
}
