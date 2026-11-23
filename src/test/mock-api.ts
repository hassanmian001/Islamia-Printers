import { vi } from "vitest";

import type {
  BillDocumentDto,
  ContactDto,
  LedgerStatementDto,
  SaleDetailDto,
  SaleJobDto,
  StyleCraftApi,
  WorkCharge,
} from "@/types/stylecraft-api";

type DeepPartialApi = { [Group in keyof StyleCraftApi]?: Partial<StyleCraftApi[Group]> };

/** A window.stylecraft whose every call resolves to something harmless, with the parts a test cares about swapped in. */
export function createMockApi(overrides: DeepPartialApi = {}): StyleCraftApi {
  const api: StyleCraftApi = {
    audit: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
    backup: {
      getSettings: vi.fn().mockResolvedValue({ backupLocation: "D:\\Backups", isDefaultLocation: true }),
      updateLocation: vi.fn().mockResolvedValue({ backupLocation: "D:\\Backups", isDefaultLocation: false }),
      create: vi.fn().mockResolvedValue({}),
      restore: vi.fn().mockResolvedValue({}),
      chooseDirectory: vi.fn().mockResolvedValue(null),
      chooseFile: vi.fn().mockResolvedValue(null),
    },
    contacts: {
      listCustomers: vi.fn().mockResolvedValue([]),
      createCustomer: vi.fn().mockResolvedValue({}),
      updateCustomer: vi.fn().mockResolvedValue({}),
      deleteCustomer: vi.fn().mockResolvedValue(undefined),
    },
    dashboard: { getSummary: vi.fn().mockResolvedValue({}) },
    invoices: {
      getBill: vi.fn().mockResolvedValue({}),
      getFolder: vi.fn().mockResolvedValue({ folder: "D:/Invoices", isDefaultFolder: true }),
      chooseFolder: vi.fn().mockResolvedValue(null),
      updateFolder: vi.fn().mockResolvedValue({ folder: "D:/Invoices", isDefaultFolder: false }),
      savePdf: vi.fn().mockResolvedValue({ filePath: "D:/Invoices/file.pdf", folder: "D:/Invoices" }),
      reveal: vi.fn().mockResolvedValue(undefined),
    },
    ledger: {
      getSummary: vi.fn().mockResolvedValue({ customers: [], totalReceivableCents: 0 }),
      getStatement: vi.fn().mockResolvedValue({}),
      nextReceiptNumber: vi.fn().mockResolvedValue(1),
      recordPayment: vi.fn().mockResolvedValue({}),
      listPayments: vi.fn().mockResolvedValue([]),
      deletePayment: vi.fn().mockResolvedValue(undefined),
    },
    quotations: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({}),
      nextNumber: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
      convertToSale: vi.fn().mockResolvedValue({}),
    },
    reports: { getReports: vi.fn().mockResolvedValue({}) },
    sales: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({}),
      nextBillNumber: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    security: {
      getEditPasswordStatus: vi.fn().mockResolvedValue({ isSet: false }),
      setEditPassword: vi.fn().mockResolvedValue({ isSet: true }),
      clearEditPassword: vi.fn().mockResolvedValue({ isSet: false }),
      verifyEditPassword: vi.fn().mockResolvedValue(true),
    },
    settings: {
      getBusinessSettings: vi.fn().mockResolvedValue({ businessName: "Islamia Printers", phone: null, email: null, address: null, currencySymbol: "Rs.", invoicePrefix: "INV" }),
      updateBusinessSettings: vi.fn().mockImplementation(async (input) => input),
    },
    update: { check: vi.fn().mockResolvedValue({ status: "dev-mode" }) },
  };

  for (const [group, members] of Object.entries(overrides)) {
    Object.assign(api[group as keyof StyleCraftApi], members);
  }

  return api;
}

export const business = { businessName: "Islamia Printers", phone: "0300-0000000", email: null, address: "Press Market, Faisalabad", currencySymbol: "Rs." };

export function customer(overrides: Partial<ContactDto> = {}): ContactDto {
  return {
    id: 1,
    name: "Islamia Press",
    phone: "0300-6609031",
    email: null,
    address: null,
    notes: null,
    openingBalanceCents: 0,
    createdAt: new Date("2026-10-01T00:00:00"),
    updatedAt: new Date("2026-10-01T00:00:00"),
    ...overrides,
  };
}

export function charge(qty: number, rateCents: number): WorkCharge {
  return { qty, rateCents, amountCents: Math.round(qty * rateCents) };
}

const nothing = charge(0, 0);

export function saleJob(overrides: Partial<SaleJobDto> = {}): SaleJobDto {
  const job = { id: 1, position: 0, jobName: "Visiting cards", rota: charge(1000, 200), gto: nothing, cutting: charge(1, 5_000), lamination: nothing, dye: nothing, ...overrides };

  return { ...job, totalAmountCents: overrides.totalAmountCents ?? job.rota.amountCents + job.gto.amountCents + job.cutting.amountCents + job.lamination.amountCents + job.dye.amountCents };
}

export function saleDetail(overrides: Partial<SaleDetailDto> = {}): SaleDetailDto {
  const jobs = overrides.jobs ?? [saleJob()];

  return {
    id: 7,
    billNumber: 15,
    kind: "job",
    customerId: 1,
    customerName: "Islamia Press",
    customerPhone: "0300-6609031",
    saleDate: new Date("2026-11-10T00:00:00"),
    totalAmountCents: jobs.reduce((sum, job) => sum + job.totalAmountCents, 0),
    notes: null,
    jobs,
    items: [],
    advanceCents: 0,
    advanceMethod: null,
    advanceReference: null,
    balanceCents: jobs.reduce((sum, job) => sum + job.totalAmountCents, 0),
    createdAt: new Date("2026-11-10T09:00:00"),
    updatedAt: new Date("2026-11-10T09:00:00"),
    ...overrides,
  };
}

export function billDocument(overrides: Partial<BillDocumentDto> = {}): BillDocumentDto {
  const sale = { ...saleDetail(), ...overrides };

  return { customerAddress: "Jhang Bazar", business, previousBalanceCents: 0, closingBalanceCents: sale.totalAmountCents - sale.advanceCents, ...sale };
}

export function ledgerStatement(overrides: Partial<LedgerStatementDto> = {}): LedgerStatementDto {
  const job = saleJob();

  return {
    customer: { id: 1, name: "Islamia Press", phone: "0300-6609031", address: null },
    startDate: "2026-10-01",
    endDate: "2026-11-16",
    openingBalanceCents: 20_909_100,
    entries: [
      {
        kind: "bill",
        saleKind: "job",
        saleId: 7,
        billNumber: 15,
        date: new Date("2026-10-01T00:00:00"),
        notes: null,
        jobs: [{ ...job, balanceCents: 20_909_100 + job.totalAmountCents }],
        items: [],
        workTotals: { rota: job.rota.amountCents, gto: 0, cutting: job.cutting.amountCents, lamination: 0, dye: 0 },
        totalAmountCents: job.totalAmountCents,
        balanceCents: 20_909_100 + job.totalAmountCents,
      },
      {
        kind: "payment",
        paymentId: 3,
        receiptNumber: 1003,
        date: new Date("2026-10-10T00:00:00"),
        method: "cash",
        narration: "mzn",
        billNumber: null,
        amountCents: 5_000_000,
        balanceCents: 20_909_100 + job.totalAmountCents - 5_000_000,
      },
    ],
    workTotals: { rota: job.rota.amountCents, gto: 0, cutting: job.cutting.amountCents, lamination: 0, dye: 0 },
    debitCents: job.totalAmountCents,
    creditCents: 5_000_000,
    closingBalanceCents: 20_909_100 + job.totalAmountCents - 5_000_000,
    business,
    generatedAt: new Date("2026-11-16T14:32:10"),
    ...overrides,
  };
}
