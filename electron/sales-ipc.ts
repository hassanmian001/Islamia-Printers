import type { IpcMain } from "electron";

import type { SaleInput, SaleListFilters } from "../src/types/stylecraft-api.js";
export { salesChannels } from "./ipc-channels.js";
import { salesChannels } from "./ipc-channels.js";

export function registerSalesHandlers(ipcMain: IpcMain) {
  ipcMain.handle(salesChannels.list, async (_event, filters?: SaleListFilters) => {
    const [{ getDatabasePath }, { listSales }] = await Promise.all([import("../db/paths.js"), import("../db/sales-service.js")]);

    return listSales(getDatabasePath(), filters);
  });

  ipcMain.handle(salesChannels.get, async (_event, id: number) => {
    const [{ getDatabasePath }, { getSale }] = await Promise.all([import("../db/paths.js"), import("../db/sales-service.js")]);

    return getSale(getDatabasePath(), id);
  });

  ipcMain.handle(salesChannels.nextBillNumber, async () => {
    const [{ getDatabasePath }, { getNextBillNumber }] = await Promise.all([import("../db/paths.js"), import("../db/sales-service.js")]);

    return getNextBillNumber(getDatabasePath());
  });

  ipcMain.handle(salesChannels.create, async (_event, input: SaleInput) => {
    const [{ getDatabasePath }, { createSale }] = await Promise.all([import("../db/paths.js"), import("../db/sales-service.js")]);

    return createSale(getDatabasePath(), input);
  });

  // Changing or removing a recorded bill is gated on the shop's edit password.
  // The check runs here in the main process so the renderer can never skip it.
  ipcMain.handle(salesChannels.update, async (_event, id: number, input: SaleInput, password: string, actorName?: string | null) => {
    const [{ getDatabasePath }, { assertEditPassword }, { updateSale }] = await Promise.all([
      import("../db/paths.js"),
      import("../db/edit-password-service.js"),
      import("../db/sales-service.js"),
    ]);
    const databasePath = getDatabasePath();

    assertEditPassword(databasePath, password);

    return updateSale(databasePath, id, input, actorName);
  });

  ipcMain.handle(salesChannels.delete, async (_event, id: number, password: string, actorName?: string | null) => {
    const [{ getDatabasePath }, { assertEditPassword }, { deleteSale }] = await Promise.all([
      import("../db/paths.js"),
      import("../db/edit-password-service.js"),
      import("../db/sales-service.js"),
    ]);
    const databasePath = getDatabasePath();

    assertEditPassword(databasePath, password);

    return deleteSale(databasePath, id, actorName);
  });
}
