export type SectionId = "dashboard" | "sales" | "cash" | "quotation" | "payments" | "ledger" | "contacts" | "reports" | "settings";

export type IconName = "dashboard" | "contacts" | "sales" | "cash" | "quotation" | "payments" | "ledger" | "reports" | "settings" | "chart";

export type Section = {
  id: SectionId;
  label: string;
  description: string;
  icon: IconName;
};

export type ModuleCard = {
  title: string;
  description: string;
  icon: IconName;
};

export const sections: Section[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Today's and this month's sales, payments received, and who owes the most.",
    icon: "dashboard",
  },
  {
    id: "sales",
    label: "Sales",
    description: "Enter a bill: date, customer and each job's Rota, GTO, cutting, lamination and dye charges.",
    icon: "sales",
  },
  {
    id: "cash",
    label: "Cash Sale",
    description: "A counter sale written like the bill book: description, qty, rate, with advance (cash or online) and balance.",
    icon: "cash",
  },
  {
    id: "quotation",
    label: "Quotation",
    description: "Rates quoted before the work, printed on the bill book and turned into a bill when agreed.",
    icon: "quotation",
  },
  {
    id: "payments",
    label: "Payment Received",
    description: "Money received from a party, in cash or online, credited to their khata.",
    icon: "payments",
  },
  {
    id: "ledger",
    label: "Ledger",
    description: "Each customer's statement of account, with payments received against it.",
    icon: "ledger",
  },
  {
    id: "contacts",
    label: "Customers",
    description: "Customer names, phone numbers and opening balances.",
    icon: "contacts",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Sales by date range and by kind of work, with Excel export.",
    icon: "reports",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Business details, edit password, PDF folder, backups and updates.",
    icon: "settings",
  },
];

export const moduleCards: Record<SectionId, ModuleCard[]> = {
  dashboard: [
    { title: "Sales pulse", description: "Today's and this month's sales totals.", icon: "chart" },
    { title: "Receivables", description: "Who still owes money, highest first.", icon: "ledger" },
  ],
  sales: [
    { title: "Bill entry", description: "One bill per customer, one line per job.", icon: "sales" },
    { title: "Qty x rate", description: "Each kind of work is charged as quantity times rate.", icon: "chart" },
  ],
  cash: [
    { title: "Bill book entry", description: "Description, qty and rate, like the printed bill.", icon: "cash" },
    { title: "Advance and balance", description: "Advance taken in cash or online; the balance stays on the khata.", icon: "payments" },
  ],
  quotation: [
    { title: "Rates before work", description: "Description, qty and rate, off the khata.", icon: "quotation" },
    { title: "One-click bill", description: "Turn an agreed quotation into a cash sale bill.", icon: "cash" },
  ],
  payments: [
    { title: "Receipts", description: "Every payment gets its own CR number.", icon: "payments" },
    { title: "Cash or online", description: "See how much came in by each.", icon: "chart" },
  ],
  ledger: [
    { title: "Statement of account", description: "Opening balance, bills with sub-totals, payments and running balance.", icon: "ledger" },
    { title: "Payments", description: "Record money received with its own receipt number.", icon: "sales" },
  ],
  contacts: [
    { title: "Customer directory", description: "Names, phone numbers, addresses and notes.", icon: "contacts" },
    { title: "Opening balances", description: "Carry old udhaar into the khata.", icon: "ledger" },
  ],
  reports: [
    { title: "Sales report", description: "Every job sold in a date range.", icon: "reports" },
    { title: "Work-wise totals", description: "What Rota, GTO, cutting, lamination and dye each earned.", icon: "chart" },
  ],
  settings: [
    { title: "Business profile", description: "Name, phone and address printed on bills and statements.", icon: "settings" },
    { title: "Backups", description: "Save and restore the database.", icon: "reports" },
  ],
};
