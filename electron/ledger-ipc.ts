import type { IpcMain } from "electron";

import type { LedgerFilters, PaymentInput } from "../src/types/stylecraft-api.js";
export { ledgerChannels } from "./ipc-channels.js";
import { ledgerChannels } from "./ipc-channels.js";

export function registerLedgerHandlers(ipcMain: IpcMain) {
  ipcMain.handle(ledgerChannels.getSummary, async () => {
    const [{ getDatabasePath }, { getLedgerSummary }] = await Promise.all([import("../db/paths.js"), import("../db/ledger-service.js")]);

    return getLedgerSummary(getDatabasePath());
  });

  ipcMain.handle(ledgerChannels.getStatement, async (_event, customerId: number, filters?: LedgerFilters) => {
    const [{ getDatabasePath }, { getLedgerStatement }] = await Promise.all([import("../db/paths.js"), import("../db/ledger-service.js")]);

    return getLedgerStatement(getDatabasePath(), customerId, filters);
  });

  ipcMain.handle(ledgerChannels.nextReceiptNumber, async () => {
    const [{ getDatabasePath }, { getNextReceiptNumber }] = await Promise.all([import("../db/paths.js"), import("../db/ledger-service.js")]);

    return getNextReceiptNumber(getDatabasePath());
  });

  ipcMain.handle(ledgerChannels.recordPayment, async (_event, input: PaymentInput) => {
    const [{ getDatabasePath }, { recordPayment }] = await Promise.all([import("../db/paths.js"), import("../db/ledger-service.js")]);

    return recordPayment(getDatabasePath(), input);
  });

  // Removing a payment changes what a customer owes, so it sits behind the edit password.
  ipcMain.handle(ledgerChannels.deletePayment, async (_event, id: number, password: string, actorName?: string | null) => {
    const [{ getDatabasePath }, { assertEditPassword }, { deletePayment }] = await Promise.all([
      import("../db/paths.js"),
      import("../db/edit-password-service.js"),
      import("../db/ledger-service.js"),
    ]);
    const databasePath = getDatabasePath();

    assertEditPassword(databasePath, password);

    return deletePayment(databasePath, id, actorName);
  });
}
