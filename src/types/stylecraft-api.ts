import type { WorkAmounts, WorkCharge, WorkChargeInput, WorkKind } from "../lib/job-math.js";

export type { WorkAmounts, WorkCharge, WorkChargeInput, WorkKind };

export type AuditLogInput = {
  action: string;
  entityType: string;
  entityId?: number | null;
  actorName?: string | null;
  details?: string | null;
};

export type AuditLogListFilters = {
  action?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  search?: string | null;
};

export type AuditLogDto = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  actorName: string | null;
  details: string | null;
  createdAt: Date;
};

export type AuditApi = {
  list(filters?: AuditLogListFilters): Promise<AuditLogDto[]>;
  create(input: AuditLogInput): Promise<AuditLogDto>;
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type ContactInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  /** What the customer already owed before any bill here. Negative is money held in advance. */
  openingBalanceCents?: number;
};

export type ContactListFilters = {
  search?: string;
};

export type ContactDto = ContactInput & {
  id: number;
  openingBalanceCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactsApi = {
  listCustomers(filters?: ContactListFilters): Promise<ContactDto[]>;
  createCustomer(input: ContactInput): Promise<ContactDto>;
  updateCustomer(id: number, input: ContactInput): Promise<ContactDto>;
  /** Only a customer with no bills or payments can be deleted. */
  deleteCustomer(id: number): Promise<void>;
};

// ---------------------------------------------------------------------------
// Sales: one bill per customer visit, one or more printing jobs on it
// ---------------------------------------------------------------------------

/** "job": printing jobs with Rota/GTO/Cutting/Lamination/Dye. "cash": plain description / qty / rate lines. */
export type SaleKind = "job" | "cash";

/** How money came in: cash in hand, or an online transfer (bank, JazzCash, Easypaisa...). */
export type PaymentMethod = "cash" | "online";

export type SaleJobInput = {
  jobName: string;
} & Record<WorkKind, WorkChargeInput>;

export type CashSaleItemInput = {
  description: string;
  qty: number;
  rateCents: number;
};

export type SaleInput = {
  /** Defaults to "job". */
  kind?: SaleKind;
  customerId: number;
  saleDate: Date | string;
  notes?: string | null;
  /** The lines of a job bill. */
  jobs?: SaleJobInput[];
  /** The lines of a cash sale bill. */
  items?: CashSaleItemInput[];
  /** Money taken with the bill ("Adv." on the bill). It is recorded as a payment on the customer's khata. */
  advanceCents?: number;
  advanceMethod?: PaymentMethod;
  /** Detail of an online advance, e.g. "JazzCash 0300... TID 1234". */
  advanceReference?: string | null;
};

export type CashSaleItemDto = {
  id: number;
  position: number;
  description: string;
  qty: number;
  rateCents: number;
  amountCents: number;
};

export type SaleJobDto = {
  id: number;
  position: number;
  jobName: string;
  totalAmountCents: number;
} & Record<WorkKind, WorkCharge>;

export type SaleDetailDto = {
  id: number;
  billNumber: number;
  kind: SaleKind;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  saleDate: Date;
  totalAmountCents: number;
  notes: string | null;
  jobs: SaleJobDto[];
  items: CashSaleItemDto[];
  advanceCents: number;
  advanceMethod: PaymentMethod | null;
  advanceReference: string | null;
  /** Total minus the advance taken with the bill; later payments are not counted here. */
  balanceCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SaleHistoryDto = Omit<SaleDetailDto, "jobs" | "items"> & {
  /** Number of lines on the bill: jobs for a job bill, items for a cash sale. */
  jobCount: number;
  /** Job names, or item descriptions for a cash sale. */
  jobNames: string[];
};

export type SaleListFilters = {
  kind?: SaleKind | null;
  customerId?: number | null;
  search?: string | null;
  /** "YYYY-MM-DD", inclusive. */
  startDate?: string | null;
  /** "YYYY-MM-DD", inclusive. */
  endDate?: string | null;
};

export type SalesApi = {
  list(filters?: SaleListFilters): Promise<SaleHistoryDto[]>;
  get(id: number): Promise<SaleDetailDto>;
  nextBillNumber(): Promise<number>;
  create(input: SaleInput): Promise<SaleDetailDto>;
  update(id: number, input: SaleInput, password: string, actorName?: string | null): Promise<SaleDetailDto>;
  delete(id: number, password: string, actorName?: string | null): Promise<void>;
};

// ---------------------------------------------------------------------------
// Ledger (khata)
// ---------------------------------------------------------------------------

export type PaymentInput = {
  customerId: number;
  amountCents: number;
  paymentDate: Date | string;
  /** Defaults to "cash". */
  method?: PaymentMethod;
  /** Detail written on the khata: "mzn", "JazzCash TID 1234", a bank name... */
  narration?: string | null;
};

export type PaymentDto = {
  id: number;
  receiptNumber: number;
  customerId: number;
  amountCents: number;
  paymentDate: Date;
  method: PaymentMethod;
  narration: string | null;
  /** Set when this is the advance taken with a bill. */
  saleId: number | null;
};

export type PaymentListItemDto = PaymentDto & {
  customerName: string;
  /** The bill this advance was taken with, if any. */
  billNumber: number | null;
};

export type PaymentListFilters = {
  customerId?: number | null;
  method?: PaymentMethod | null;
  /** "YYYY-MM-DD", inclusive. */
  startDate?: string | null;
  /** "YYYY-MM-DD", inclusive. */
  endDate?: string | null;
};

export type LedgerCustomerSummaryDto = {
  customerId: number;
  customerName: string;
  phone: string | null;
  openingBalanceCents: number;
  billedCents: number;
  receivedCents: number;
  balanceCents: number;
  lastActivityDate: Date | null;
};

export type LedgerSummaryDto = {
  customers: LedgerCustomerSummaryDto[];
  /** Sum of every balance still owed to the shop; advances are not netted off. */
  totalReceivableCents: number;
};

export type LedgerFilters = {
  /** "YYYY-MM-DD", inclusive. Everything before it is carried in as the opening balance. */
  startDate?: string | null;
  /** "YYYY-MM-DD", inclusive. */
  endDate?: string | null;
};

export type LedgerJobRowDto = SaleJobDto & {
  /** Running balance after this job. */
  balanceCents: number;
};

export type LedgerCashItemRowDto = CashSaleItemDto & {
  /** Running balance after this line. */
  balanceCents: number;
};

export type LedgerBillEntryDto = {
  kind: "bill";
  saleKind: SaleKind;
  saleId: number;
  billNumber: number;
  date: Date;
  notes: string | null;
  jobs: LedgerJobRowDto[];
  items: LedgerCashItemRowDto[];
  workTotals: WorkAmounts;
  totalAmountCents: number;
  /** Running balance after the whole bill. */
  balanceCents: number;
};

export type LedgerPaymentEntryDto = {
  kind: "payment";
  paymentId: number;
  receiptNumber: number;
  date: Date;
  method: PaymentMethod;
  narration: string | null;
  /** The bill this advance was taken with, if any. */
  billNumber: number | null;
  amountCents: number;
  balanceCents: number;
};

export type LedgerEntryDto = LedgerBillEntryDto | LedgerPaymentEntryDto;

export type BusinessDocumentSettingsDto = {
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currencySymbol: string;
};

export type LedgerStatementDto = {
  customer: {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
  };
  startDate: string | null;
  endDate: string | null;
  /** Balance brought forward: the customer's opening balance plus everything before startDate. */
  openingBalanceCents: number;
  entries: LedgerEntryDto[];
  workTotals: WorkAmounts;
  debitCents: number;
  creditCents: number;
  closingBalanceCents: number;
  business: BusinessDocumentSettingsDto;
  generatedAt: Date;
};

export type LedgerApi = {
  getSummary(): Promise<LedgerSummaryDto>;
  getStatement(customerId: number, filters?: LedgerFilters): Promise<LedgerStatementDto>;
  nextReceiptNumber(): Promise<number>;
  recordPayment(input: PaymentInput): Promise<PaymentDto>;
  listPayments(filters?: PaymentListFilters): Promise<PaymentListItemDto[]>;
  deletePayment(id: number, password: string, actorName?: string | null): Promise<void>;
};

// ---------------------------------------------------------------------------
// Dashboard and reports
// ---------------------------------------------------------------------------

export type DashboardReceivableDto = {
  customerId: number;
  customerName: string;
  phone: string | null;
  balanceCents: number;
};

export type DashboardSummaryDto = {
  todaySalesCents: number;
  todayBillCount: number;
  monthSalesCents: number;
  monthBillCount: number;
  monthReceivedCents: number;
  monthReceivedCashCents: number;
  monthReceivedOnlineCents: number;
  totalReceivableCents: number;
  customerCount: number;
  monthWorkTotals: WorkAmounts;
  topReceivables: DashboardReceivableDto[];
};

export type DashboardApi = {
  getSummary(): Promise<DashboardSummaryDto>;
};

export type ReportFilters = {
  /** "YYYY-MM-DD", inclusive. */
  startDate?: string | null;
  /** "YYYY-MM-DD", inclusive. */
  endDate?: string | null;
  customerId?: number | null;
};

export type SalesReportRowDto = {
  saleId: number;
  billNumber: number;
  saleKind: SaleKind;
  /** Quantity and rate of a cash sale line; zero for job rows, whose figures are per kind of work. */
  qty: number;
  rateCents: number;
  saleDate: Date;
  customerName: string;
  jobName: string;
  totalAmountCents: number;
} & Record<WorkKind, WorkCharge>;

export type ReportsDto = {
  filters: ReportFilters;
  rows: SalesReportRowDto[];
  workTotals: WorkAmounts;
  salesTotalCents: number;
  /** Part of salesTotalCents that came from cash sale bills. */
  cashSalesCents: number;
  billCount: number;
  jobCount: number;
  receivedCents: number;
  receivedCashCents: number;
  receivedOnlineCents: number;
};

export type ReportsApi = {
  getReports(filters?: ReportFilters): Promise<ReportsDto>;
};

// ---------------------------------------------------------------------------
// Printable documents
// ---------------------------------------------------------------------------

export type BillDocumentDto = SaleDetailDto & {
  customerAddress: string | null;
  /** "P. Bal" on the bill: what the customer owed just before this bill, in khata order. */
  previousBalanceCents: number;
  /** "BAL." on the bill: P. Bal + this bill's total - the advance taken with it. */
  closingBalanceCents: number;
  business: BusinessDocumentSettingsDto;
};

export type InvoiceFolderDto = {
  folder: string;
  isDefaultFolder: boolean;
};

export type SavePdfInput = {
  html: string;
  fileName: string;
  saveAs?: boolean;
  /** Wide documents such as the khata print sideways. */
  landscape?: boolean;
  /** A5 for bill-book bills, printed edge to edge; A4 (the default) otherwise. */
  pageSize?: "A4" | "A5";
};

/** `filePath` is null when the save dialog was closed without picking a file. */
export type SavePdfResultDto = {
  filePath: string | null;
  folder: string;
};

export type InvoiceApi = {
  getBill(saleId: number): Promise<BillDocumentDto>;
  getFolder(): Promise<InvoiceFolderDto>;
  chooseFolder(): Promise<string | null>;
  updateFolder(folder: string): Promise<InvoiceFolderDto>;
  savePdf(input: SavePdfInput): Promise<SavePdfResultDto>;
  reveal(filePath: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Backup, settings, security, updates
// ---------------------------------------------------------------------------

export type BackupSettingsDto = {
  backupLocation: string;
  isDefaultLocation: boolean;
};

export type BackupResultDto = {
  backupPath: string;
  backupDirectory: string;
  createdAt: Date;
};

export type RestoreResultDto = {
  restoredFrom: string;
  restoredAt: Date;
};

export type BackupApi = {
  getSettings(): Promise<BackupSettingsDto>;
  updateLocation(backupLocation: string): Promise<BackupSettingsDto>;
  create(): Promise<BackupResultDto>;
  restore(backupPath: string): Promise<RestoreResultDto>;
  chooseDirectory(): Promise<string | null>;
  chooseFile(): Promise<string | null>;
};

export type BusinessSettingsDto = {
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currencySymbol: string;
  invoicePrefix: string;
};

export type SettingsApi = {
  getBusinessSettings(): Promise<BusinessSettingsDto>;
  updateBusinessSettings(input: BusinessSettingsDto): Promise<BusinessSettingsDto>;
};

export type UpdateCheckResult =
  | { status: "dev-mode" }
  | { status: "up-to-date"; currentVersion: string }
  | { status: "update-available"; version: string }
  | { status: "already-downloaded"; version: string }
  | { status: "error"; message: string };

export type UpdateApi = {
  check(): Promise<UpdateCheckResult>;
};

export type ThemePreference = "light" | "dark" | "system";

export type EditPasswordStatusDto = {
  isSet: boolean;
};

export type SecurityApi = {
  getEditPasswordStatus(): Promise<EditPasswordStatusDto>;
  setEditPassword(newPassword: string, currentPassword?: string | null): Promise<EditPasswordStatusDto>;
  clearEditPassword(currentPassword: string): Promise<EditPasswordStatusDto>;
  verifyEditPassword(password: string): Promise<boolean>;
};

export type StyleCraftApi = {
  audit: AuditApi;
  backup: BackupApi;
  contacts: ContactsApi;
  dashboard: DashboardApi;
  invoices: InvoiceApi;
  ledger: LedgerApi;
  reports: ReportsApi;
  sales: SalesApi;
  security: SecurityApi;
  settings: SettingsApi;
  update: UpdateApi;
};
