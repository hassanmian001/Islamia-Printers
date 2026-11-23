# Islamia Printers Sales & Khata Software

Desktop software for Islamia Printers: job bills entered by hand, and a khata (statement of account) for every customer that updates from them.

## Current State

Sales bills with one line per printing job, customer khata with payments received, a printable statement of account laid out like a paper ledger, dashboard, sales report with Excel export, manual backup and restore, a Windows installer, automatic updates from GitHub Releases, and dark mode.

There is no product list, stock, purchase, supplier or return tracking. Those were removed on 2026-11-22; migration `0005_drop_inventory_tables` drops their tables.

## Sales

- One bill per customer visit, numbered automatically (shown as `15 SV` on the khata).
- A bill holds one or more jobs. Each job has a job name and five kinds of work: Rota P, GTO P, Cutting, Lamination and Dye.
- Each kind of work is quantity × rate. Leave the quantity empty for a flat charge and it counts as 1. Quantities may be fractional (2.5).
- The job's Grand Total is the sum of its five amounts; the bill total is the sum of its jobs. Totals update as you type.
- Every bill must belong to a customer; a new customer can be added from the bill form.
- Bills can be viewed, printed and saved as PDF, edited and deleted. Editing and deleting ask for the edit password when one is set in Settings, checked in the main process, and leave an audit-log entry.
- Bill history can be filtered by customer, date range, and bill number / customer / job name.

## Cash Sale

- A counter sale written like the shop's bill book: Description, Qty, Rate, Amount (qty × rate).
- Every cash sale belongs to a customer and goes on their khata (shown as `16 CS`), sharing bill numbers with job bills.
- Take an advance in **cash or online** (with a detail such as JazzCash / bank / TID). The advance is recorded as a payment on the khata; Bal. = Total − Adv. stays as the customer's balance. "Paid in full" fills the whole total.
- Job bills (Sales) can take an advance the same way.
- Editing a bill keeps its advance's receipt number; clearing the advance or deleting the bill removes it. An advance cannot be deleted on its own.

## Payment Received

- Receive money from a party in **Cash** or **Online**, with a narration or online detail. Each receipt gets its own number (`3 CR`) and credits the khata.
- Shows the party's current balance before saving.
- Lists every receipt (advances included, marked with their bill) with cash and online totals, filtered by party, method and date.

## Printed bill

- Every bill (job or cash) prints like the bill book: logo and business name, address and contacts from Settings, Date / Sr. / Name, a Description / Qty / Rate / Amount table, Total / Adv. / Bal., and a signature line.
- A job charged for several kinds of work prints its name, then one line per kind (Rota P, GTO P, ...).
- In Settings, separate two contacts in the Phone field with `;`.

## Ledger (khata)

- A customer's balance is their opening balance plus every bill minus every payment received.
- The statement of account shows the opening balance, then each bill job by job with a running balance and a Sub-Total row, payments received in between (`1003 CR`), a Grand Total row with totals per kind of work, and the final balance.
- Pick a From / To date: everything before the From date is carried in as the opening balance, as on a printed statement.
- Same-day entries keep the order they were typed in.
- Download the statement as a landscape A4 PDF, or print it.
- Record a payment received with date, amount and narration (cash, mzn, bank...). Each gets its own receipt number. A mistaken payment can be deleted behind the edit password.
- Old udhaar from before this software is entered as the customer's opening balance.

## Customers

- Name, phone, email, address, notes and opening balance.
- A customer can be deleted only while they have no bills or payments.

## Dashboard

- Today's and this month's sales, payments received this month, total receivable and customer count.
- This month's sales split by kind of work.
- The customers with the highest balances.

## Reports

- Sales report for a date range, optionally for one customer: one row per job with each kind of work's qty × rate and amount.
- Totals per kind of work, bills and jobs counted, and payments received in the same period.
- Export as an Excel-compatible CSV (qty, rate and amount columns per kind of work), or print.

## Backup And Restore

- Configure the backup folder in Settings.
- Create timestamped manual SQLite backups.
- Prevent silent backup overwrite when a generated backup filename already exists.
- Restore the active database from a selected backup file.

## Appearance

- Light, dark, or match the Windows setting; the choice is remembered and applied before the window paints.
- Toggle from the sidebar, or pick the mode in Settings.

## Windows Packaging

- Build a Windows NSIS installer with electron-builder.
- Store packaged app data in Electron's user data directory as `islamia-printers.sqlite`.
- Ship Drizzle migrations with the packaged app resources.
- Write installer artifacts to `release/`.

## Development

Install dependencies:

```powershell
npm install
```

Start the local desktop app:

```powershell
npm run dev
```

Build renderer and Electron main process:

```powershell
npm run build
```

Preview the built app:

```powershell
npm run preview
```

Build an unpacked app directory for local inspection:

```powershell
npm run package:dir
```

Build the Windows installer:

```powershell
npm run package:win
```

## Database

Generate migrations from the Drizzle schema:

```powershell
npm run db:generate
```

Apply migrations to the local development database:

```powershell
npm run db:migrate
```

Verify the database with a sample query:

```powershell
npm run db:verify
```

The development database is created at `.local/islamia-printers-dev.sqlite`. The packaged app uses Electron's user data directory and stores data in `islamia-printers.sqlite`.

## Planned Features

- Optional automatic backup on app close
- App icon and code signing assets
