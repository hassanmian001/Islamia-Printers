# Agent Instructions

This repository is for building **Islamia Printers Sales & Khata Software**.

Before making code changes:

1. Read `OPENCODE.md`.
2. Read the files in `docs/`.
3. Use `prd.json` as the milestone/task source.

Build incrementally. Start with milestone 1 unless the user asks for a different milestone.

Preferred stack:

- Electron
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- SQLite
- Drizzle ORM
- Vitest
- electron-builder

Scope change (2026-11-22): the owner asked for products, stock, purchases,
suppliers and returns to be removed. The app now keeps only manually entered
job sales and a customer khata. The stock and purchase rules in `OPENCODE.md`
and `docs/` describe the old scope and no longer apply; do not reintroduce them.

Important rules:

- A sale bill belongs to one customer and holds one or more jobs.
- Each job is charged for Rota P, GTO P, Cutting, Lamination and Dye, each as quantity x rate; the job's Grand Total is their sum (`src/lib/job-math.ts`).
- A customer's balance is opening balance + bills - payments received. Every bill and payment shows on their ledger.
- Use database transactions when saving a bill and its jobs.
- Editing or deleting a bill or payment goes through the edit password, checked in the main process.
- Keep bill totals and ledger balances covered by tests.

When a milestone is complete, run the relevant tests or verification commands and report what passed.

