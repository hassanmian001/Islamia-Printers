const { contextBridge, ipcRenderer } = require("electron");

const auditChannels = {
  list: "audit:list",
  create: "audit:create",
};

const backupChannels = {
  getSettings: "backup:getSettings",
  updateLocation: "backup:updateLocation",
  create: "backup:create",
  restore: "backup:restore",
  chooseDirectory: "backup:chooseDirectory",
  chooseFile: "backup:chooseFile",
};

const dashboardChannels = {
  getSummary: "dashboard:getSummary",
};

const contactsChannels = {
  listCustomers: "contacts:listCustomers",
  createCustomer: "contacts:createCustomer",
  updateCustomer: "contacts:updateCustomer",
  deleteCustomer: "contacts:deleteCustomer",
};

const invoiceChannels = {
  getBill: "invoices:getBill",
  getFolder: "invoices:getFolder",
  chooseFolder: "invoices:chooseFolder",
  updateFolder: "invoices:updateFolder",
  savePdf: "invoices:savePdf",
  reveal: "invoices:reveal",
};

const quotationChannels = {
  list: "quotations:list",
  get: "quotations:get",
  nextNumber: "quotations:nextNumber",
  create: "quotations:create",
  update: "quotations:update",
  delete: "quotations:delete",
  convertToSale: "quotations:convertToSale",
};

const reportsChannels = {
  getReports: "reports:getReports",
};

const salesChannels = {
  list: "sales:list",
  get: "sales:get",
  nextBillNumber: "sales:nextBillNumber",
  create: "sales:create",
  update: "sales:update",
  delete: "sales:delete",
};

const settingsChannels = {
  getBusinessSettings: "settings:getBusinessSettings",
  updateBusinessSettings: "settings:updateBusinessSettings",
};

const ledgerChannels = {
  getSummary: "ledger:getSummary",
  getStatement: "ledger:getStatement",
  nextReceiptNumber: "ledger:nextReceiptNumber",
  recordPayment: "ledger:recordPayment",
  listPayments: "ledger:listPayments",
  deletePayment: "ledger:deletePayment",
};

const securityChannels = {
  getEditPasswordStatus: "security:getEditPasswordStatus",
  setEditPassword: "security:setEditPassword",
  clearEditPassword: "security:clearEditPassword",
  verifyEditPassword: "security:verifyEditPassword",
};

const updateChannels = {
  check: "update:check",
};

const stylecraftApi = {
  audit: {
    list: (filters) => ipcRenderer.invoke(auditChannels.list, filters),
    create: (input) => ipcRenderer.invoke(auditChannels.create, input),
  },
  backup: {
    getSettings: () => ipcRenderer.invoke(backupChannels.getSettings),
    updateLocation: (backupLocation) => ipcRenderer.invoke(backupChannels.updateLocation, backupLocation),
    create: () => ipcRenderer.invoke(backupChannels.create),
    restore: (backupPath) => ipcRenderer.invoke(backupChannels.restore, backupPath),
    chooseDirectory: () => ipcRenderer.invoke(backupChannels.chooseDirectory),
    chooseFile: () => ipcRenderer.invoke(backupChannels.chooseFile),
  },
  contacts: {
    listCustomers: (filters) => ipcRenderer.invoke(contactsChannels.listCustomers, filters),
    createCustomer: (input) => ipcRenderer.invoke(contactsChannels.createCustomer, input),
    updateCustomer: (id, input) => ipcRenderer.invoke(contactsChannels.updateCustomer, id, input),
    deleteCustomer: (id) => ipcRenderer.invoke(contactsChannels.deleteCustomer, id),
  },
  dashboard: {
    getSummary: () => ipcRenderer.invoke(dashboardChannels.getSummary),
  },
  invoices: {
    getBill: (saleId) => ipcRenderer.invoke(invoiceChannels.getBill, saleId),
    getFolder: () => ipcRenderer.invoke(invoiceChannels.getFolder),
    chooseFolder: () => ipcRenderer.invoke(invoiceChannels.chooseFolder),
    updateFolder: (folder) => ipcRenderer.invoke(invoiceChannels.updateFolder, folder),
    savePdf: (input) => ipcRenderer.invoke(invoiceChannels.savePdf, input),
    reveal: (filePath) => ipcRenderer.invoke(invoiceChannels.reveal, filePath),
  },
  ledger: {
    getSummary: () => ipcRenderer.invoke(ledgerChannels.getSummary),
    getStatement: (customerId, filters) => ipcRenderer.invoke(ledgerChannels.getStatement, customerId, filters),
    nextReceiptNumber: () => ipcRenderer.invoke(ledgerChannels.nextReceiptNumber),
    recordPayment: (input) => ipcRenderer.invoke(ledgerChannels.recordPayment, input),
    listPayments: (filters) => ipcRenderer.invoke(ledgerChannels.listPayments, filters),
    deletePayment: (id, password, actorName) => ipcRenderer.invoke(ledgerChannels.deletePayment, id, password, actorName),
  },
  quotations: {
    list: (filters) => ipcRenderer.invoke(quotationChannels.list, filters),
    get: (id) => ipcRenderer.invoke(quotationChannels.get, id),
    nextNumber: () => ipcRenderer.invoke(quotationChannels.nextNumber),
    create: (input) => ipcRenderer.invoke(quotationChannels.create, input),
    update: (id, input) => ipcRenderer.invoke(quotationChannels.update, id, input),
    delete: (id) => ipcRenderer.invoke(quotationChannels.delete, id),
    convertToSale: (id, input) => ipcRenderer.invoke(quotationChannels.convertToSale, id, input),
  },
  reports: {
    getReports: (filters) => ipcRenderer.invoke(reportsChannels.getReports, filters),
  },
  sales: {
    list: (filters) => ipcRenderer.invoke(salesChannels.list, filters),
    get: (id) => ipcRenderer.invoke(salesChannels.get, id),
    nextBillNumber: () => ipcRenderer.invoke(salesChannels.nextBillNumber),
    create: (input) => ipcRenderer.invoke(salesChannels.create, input),
    update: (id, input, password, actorName) => ipcRenderer.invoke(salesChannels.update, id, input, password, actorName),
    delete: (id, password, actorName) => ipcRenderer.invoke(salesChannels.delete, id, password, actorName),
  },
  security: {
    getEditPasswordStatus: () => ipcRenderer.invoke(securityChannels.getEditPasswordStatus),
    setEditPassword: (newPassword, currentPassword) => ipcRenderer.invoke(securityChannels.setEditPassword, newPassword, currentPassword),
    clearEditPassword: (currentPassword) => ipcRenderer.invoke(securityChannels.clearEditPassword, currentPassword),
    verifyEditPassword: (password) => ipcRenderer.invoke(securityChannels.verifyEditPassword, password),
  },
  settings: {
    getBusinessSettings: () => ipcRenderer.invoke(settingsChannels.getBusinessSettings),
    updateBusinessSettings: (input) => ipcRenderer.invoke(settingsChannels.updateBusinessSettings, input),
  },
  update: {
    check: () => ipcRenderer.invoke(updateChannels.check),
  },
};

contextBridge.exposeInMainWorld("stylecraft", stylecraftApi);
