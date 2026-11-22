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

export type SaleJobInput = {
  jobName: string;
} & Record<WorkKind, WorkChargeInput>;

export type SaleInput = {
  customerId: number;
  saleDate: Date | string;
  notes?: string | null;
  jobs: SaleJobInput[];
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
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  saleDate: Date;
  totalAmountCents: number;
  notes: string | null;
  jobs: SaleJobDto[];
  createdAt: Date;
  updatedAt: Date;
};

export type SaleHistoryDto = Omit<SaleDetailDto, "jobs"> & {
  jobCount: number;
  jobNames: string[];
};

export type SaleListFilters = {
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
  /** "cash", "mzn", "bank" or whatever the shop writes on the khata. */
  narration?: string | null;
};

export type PaymentDto = {
  id: number;
  receiptNumber: number;
  customerId: number;
  amountCents: number;
  paymentDate: Date;
  narration: string | null;
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

export type LedgerBillEntryDto = {
  kind: "bill";
  saleId: number;
  billNumber: number;
  date: Date;
  notes: string | null;
  jobs: LedgerJobRowDto[];
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
  narration: string | null;
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
  billCount: number;
  jobCount: number;
  receivedCents: number;
};

export type ReportsApi = {
  getReports(filters?: ReportFilters): Promise<ReportsDto>;
};

// ---------------------------------------------------------------------------
// Printable documents
// ---------------------------------------------------------------------------

export type BillDocumentDto = SaleDetailDto & {
  customerAddress: string | null;
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
