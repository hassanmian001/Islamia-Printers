import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { BackupValidationError, createBackup, getBackupSettings, restoreBackup, updateBackupLocation } from "./backup-service";
import { runMigrations } from "./migrate";
import { createCustomer, listCustomers } from "./contacts-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeTempDatabasePath() {
  const databasePath = path.join(makeTempDir("stylecraft-backup-db-"), "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

describe("backup service", () => {
  it("stores and returns a custom backup location", () => {
    const databasePath = makeTempDatabasePath();
    const backupDirectory = path.join(makeTempDir("stylecraft-backups-"), "nested");

    expect(getBackupSettings(databasePath)).toMatchObject({ isDefaultLocation: true });

    const settings = updateBackupLocation(databasePath, backupDirectory);

    expect(settings).toEqual({ backupLocation: path.resolve(backupDirectory), isDefaultLocation: false });
    expect(fs.existsSync(backupDirectory)).toBe(true);
  });

  it("creates timestamped backups without silently overwriting an existing backup file", () => {
    const databasePath = makeTempDatabasePath();
    const backupDirectory = makeTempDir("stylecraft-backups-");
    const now = new Date("2026-07-09T10:11:12.013Z");

    createCustomer(databasePath, { name: "Ali" });

    const backup = createBackup(databasePath, backupDirectory, now);

    expect(backup.backupDirectory).toBe(path.resolve(backupDirectory));
    expect(path.basename(backup.backupPath)).toMatch(/^islamia-printers-backup-20260709-\d{6}-013\.sqlite$/);
    expect(fs.existsSync(backup.backupPath)).toBe(true);
    expect(() => createBackup(databasePath, backupDirectory, now)).toThrow(BackupValidationError);
  });

  it("restores the active database from a backup file", () => {
    const databasePath = makeTempDatabasePath();
    const backupDirectory = makeTempDir("stylecraft-backups-");

    createCustomer(databasePath, { name: "BEFORE" });
    const backup = createBackup(databasePath, backupDirectory, new Date("2026-07-09T10:11:12.013Z"));
    createCustomer(databasePath, { name: "AFTER" });

    expect(listCustomers(databasePath).map((customer) => customer.name).sort()).toEqual(["AFTER", "BEFORE"]);

    const restoreResult = restoreBackup(databasePath, backup.backupPath, new Date("2026-07-09T11:00:00.000Z"));

    expect(restoreResult.restoredFrom).toBe(backup.backupPath);
    expect(listCustomers(databasePath).map((customer) => customer.name)).toEqual(["BEFORE"]);
  });

  it("rejects missing backup files", () => {
    const databasePath = makeTempDatabasePath();

    expect(() => restoreBackup(databasePath, path.join(makeTempDir("stylecraft-missing-"), "missing.sqlite"))).toThrow(BackupValidationError);
  });
});
