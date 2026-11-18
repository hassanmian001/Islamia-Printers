import { app, dialog, shell, type IpcMain } from "electron";
import fs from "node:fs";
import path from "node:path";

export { invoiceChannels } from "./ipc-channels.js";
import { invoiceChannels } from "./ipc-channels.js";
import { renderHtmlToPdf, uniqueFilePath } from "./pdf.js";

export type SavePdfInput = {
  html: string;
  fileName: string;
  saveAs?: boolean;
};

export type SavePdfResultDto = {
  filePath: string | null;
  folder: string;
};

function defaultInvoiceFolder() {
  return path.join(app.getPath("documents"), "Islamia Printers Invoices");
}

export function registerInvoiceHandlers(ipcMain: IpcMain) {
  ipcMain.handle(invoiceChannels.getBySaleId, async (_event, saleId: number) => {
    const [{ getDatabasePath }, { getInvoiceBySaleId }] = await Promise.all([import("../db/paths.js"), import("../db/invoices-service.js")]);

    return getInvoiceBySaleId(getDatabasePath(), saleId);
  });

  ipcMain.handle(invoiceChannels.getCustomerStatement, async (_event, customerId: number) => {
    const [{ getDatabasePath }, { getCustomerStatement }] = await Promise.all([import("../db/paths.js"), import("../db/invoices-service.js")]);

    return getCustomerStatement(getDatabasePath(), customerId);
  });

  ipcMain.handle(invoiceChannels.getFolder, async () => {
    const [{ getDatabasePath }, { getInvoiceFolder }] = await Promise.all([import("../db/paths.js"), import("../db/invoices-service.js")]);

    return getInvoiceFolder(getDatabasePath(), defaultInvoiceFolder());
  });

  ipcMain.handle(invoiceChannels.chooseFolder, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(invoiceChannels.updateFolder, async (_event, folder: string) => {
    const [{ getDatabasePath }, { updateInvoiceFolder }] = await Promise.all([import("../db/paths.js"), import("../db/invoices-service.js")]);

    return updateInvoiceFolder(getDatabasePath(), folder);
  });

  ipcMain.handle(invoiceChannels.savePdf, async (_event, input: SavePdfInput): Promise<SavePdfResultDto> => {
    const [{ getDatabasePath }, { getInvoiceFolder, invoiceFileName }] = await Promise.all([import("../db/paths.js"), import("../db/invoices-service.js")]);

    const { folder } = getInvoiceFolder(getDatabasePath(), defaultInvoiceFolder());
    const fileName = invoiceFileName([input.fileName]);
    fs.mkdirSync(folder, { recursive: true });

    if (input.saveAs === true) {
      const result = await dialog.showSaveDialog({
        defaultPath: path.join(folder, fileName),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (result.canceled || !result.filePath) {
        return { filePath: null, folder };
      }

      fs.writeFileSync(result.filePath, await renderHtmlToPdf(input.html));

      return { filePath: result.filePath, folder };
    }

    const filePath = uniqueFilePath(folder, fileName);
    fs.writeFileSync(filePath, await renderHtmlToPdf(input.html));

    return { filePath, folder };
  });

  ipcMain.handle(invoiceChannels.reveal, async (_event, filePath: string) => {
    shell.showItemInFolder(path.resolve(filePath));
  });
}
