import type { IpcMain } from "electron";

import type { ConvertQuotationInput, QuotationInput, QuotationListFilters } from "../src/types/stylecraft-api.js";
export { quotationChannels } from "./ipc-channels.js";
import { quotationChannels } from "./ipc-channels.js";

export function registerQuotationHandlers(ipcMain: IpcMain) {
  ipcMain.handle(quotationChannels.list, async (_event, filters?: QuotationListFilters) => {
    const [{ getDatabasePath }, { listQuotations }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return listQuotations(getDatabasePath(), filters);
  });

  ipcMain.handle(quotationChannels.get, async (_event, id: number) => {
    const [{ getDatabasePath }, { getQuotation }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return getQuotation(getDatabasePath(), id);
  });

  ipcMain.handle(quotationChannels.nextNumber, async () => {
    const [{ getDatabasePath }, { getNextQuotationNumber }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return getNextQuotationNumber(getDatabasePath());
  });

  ipcMain.handle(quotationChannels.create, async (_event, input: QuotationInput) => {
    const [{ getDatabasePath }, { createQuotation }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return createQuotation(getDatabasePath(), input);
  });

  ipcMain.handle(quotationChannels.update, async (_event, id: number, input: QuotationInput) => {
    const [{ getDatabasePath }, { updateQuotation }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return updateQuotation(getDatabasePath(), id, input);
  });

  ipcMain.handle(quotationChannels.delete, async (_event, id: number) => {
    const [{ getDatabasePath }, { deleteQuotation }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return deleteQuotation(getDatabasePath(), id);
  });

  ipcMain.handle(quotationChannels.convertToSale, async (_event, id: number, input: ConvertQuotationInput) => {
    const [{ getDatabasePath }, { convertQuotationToSale }] = await Promise.all([import("../db/paths.js"), import("../db/quotations-service.js")]);

    return convertQuotationToSale(getDatabasePath(), id, input);
  });
}
