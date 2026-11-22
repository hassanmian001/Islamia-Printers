import { contextBridge, ipcRenderer } from "electron";

import { auditChannels, backupChannels, contactsChannels, dashboardChannels, invoiceChannels, ledgerChannels, reportsChannels, salesChannels, securityChannels, settingsChannels, updateChannels } from "./ipc-channels.js";
import type { StyleCraftApi } from "../src/types/stylecraft-api.js";

const stylecraftApi: StyleCraftApi = {
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
    deletePayment: (id, password, actorName) => ipcRenderer.invoke(ledgerChannels.deletePayment, id, password, actorName),
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
