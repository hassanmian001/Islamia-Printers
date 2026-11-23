export const auditChannels = {
  list: "audit:list",
  create: "audit:create",
} as const;

export const backupChannels = {
  getSettings: "backup:getSettings",
  updateLocation: "backup:updateLocation",
  create: "backup:create",
  restore: "backup:restore",
  chooseDirectory: "backup:chooseDirectory",
  chooseFile: "backup:chooseFile",
} as const;

export const dashboardChannels = {
  getSummary: "dashboard:getSummary",
} as const;

export const contactsChannels = {
  listCustomers: "contacts:listCustomers",
  createCustomer: "contacts:createCustomer",
  updateCustomer: "contacts:updateCustomer",
  deleteCustomer: "contacts:deleteCustomer",
} as const;

export const invoiceChannels = {
  getBill: "invoices:getBill",
  getFolder: "invoices:getFolder",
  chooseFolder: "invoices:chooseFolder",
  updateFolder: "invoices:updateFolder",
  savePdf: "invoices:savePdf",
  reveal: "invoices:reveal",
} as const;

export const quotationChannels = {
  list: "quotations:list",
  get: "quotations:get",
  nextNumber: "quotations:nextNumber",
  create: "quotations:create",
  update: "quotations:update",
  delete: "quotations:delete",
  convertToSale: "quotations:convertToSale",
} as const;

export const reportsChannels = {
  getReports: "reports:getReports",
} as const;

export const salesChannels = {
  list: "sales:list",
  get: "sales:get",
  nextBillNumber: "sales:nextBillNumber",
  create: "sales:create",
  update: "sales:update",
  delete: "sales:delete",
} as const;

export const settingsChannels = {
  getBusinessSettings: "settings:getBusinessSettings",
  updateBusinessSettings: "settings:updateBusinessSettings",
} as const;

export const ledgerChannels = {
  getSummary: "ledger:getSummary",
  getStatement: "ledger:getStatement",
  nextReceiptNumber: "ledger:nextReceiptNumber",
  recordPayment: "ledger:recordPayment",
  listPayments: "ledger:listPayments",
  deletePayment: "ledger:deletePayment",
} as const;

export const securityChannels = {
  getEditPasswordStatus: "security:getEditPasswordStatus",
  setEditPassword: "security:setEditPassword",
  clearEditPassword: "security:clearEditPassword",
  verifyEditPassword: "security:verifyEditPassword",
} as const;

export const updateChannels = {
  check: "update:check",
} as const;
