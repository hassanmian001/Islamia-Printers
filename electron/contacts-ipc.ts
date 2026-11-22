import type { IpcMain } from "electron";

import type { ContactInput, ContactListFilters } from "../src/types/stylecraft-api.js";
export { contactsChannels } from "./ipc-channels.js";
import { contactsChannels } from "./ipc-channels.js";

export function registerContactsHandlers(ipcMain: IpcMain) {
  ipcMain.handle(contactsChannels.listCustomers, async (_event, filters?: ContactListFilters) => {
    const [{ getDatabasePath }, { listCustomers }] = await Promise.all([import("../db/paths.js"), import("../db/contacts-service.js")]);

    return listCustomers(getDatabasePath(), filters);
  });

  ipcMain.handle(contactsChannels.createCustomer, async (_event, input: ContactInput) => {
    const [{ getDatabasePath }, { createCustomer }] = await Promise.all([import("../db/paths.js"), import("../db/contacts-service.js")]);

    return createCustomer(getDatabasePath(), input);
  });

  ipcMain.handle(contactsChannels.updateCustomer, async (_event, id: number, input: ContactInput) => {
    const [{ getDatabasePath }, { updateCustomer }] = await Promise.all([import("../db/paths.js"), import("../db/contacts-service.js")]);

    return updateCustomer(getDatabasePath(), id, input);
  });

  ipcMain.handle(contactsChannels.deleteCustomer, async (_event, id: number) => {
    const [{ getDatabasePath }, { deleteCustomer }] = await Promise.all([import("../db/paths.js"), import("../db/contacts-service.js")]);

    return deleteCustomer(getDatabasePath(), id);
  });
}
