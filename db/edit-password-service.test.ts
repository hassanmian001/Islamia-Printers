import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { clearEditPassword, getEditPasswordStatus, isMasterPassword, setEditPassword, verifyEditPassword } from "./edit-password-service";
import { runMigrations } from "./migrate";

const masterPassword = "Hassan@Mian";
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stylecraft-edit-password-"));
  tempDirs.push(dir);
  const databasePath = path.join(dir, "test.sqlite");
  runMigrations(databasePath);
  return databasePath;
}

describe("edit password service", () => {
  it("sets a password and checks it", () => {
    const databasePath = makeTempDatabasePath();

    expect(getEditPasswordStatus(databasePath)).toEqual({ isSet: false });
    expect(verifyEditPassword(databasePath, "")).toBe(true);

    setEditPassword(databasePath, "shop1234");

    expect(getEditPasswordStatus(databasePath)).toEqual({ isSet: true });
    expect(verifyEditPassword(databasePath, "shop1234")).toBe(true);
    expect(verifyEditPassword(databasePath, "wrong")).toBe(false);
  });

  it("needs the current password to change it", () => {
    const databasePath = makeTempDatabasePath();
    setEditPassword(databasePath, "shop1234");

    expect(() => setEditPassword(databasePath, "newpass", "wrong")).toThrow("Current password is not correct.");
    expect(() => clearEditPassword(databasePath, "wrong")).toThrow("Current password is not correct.");

    setEditPassword(databasePath, "newpass", "shop1234");
    expect(verifyEditPassword(databasePath, "newpass")).toBe(true);
  });

  it("resets a forgotten password with the master password", () => {
    const databasePath = makeTempDatabasePath();
    setEditPassword(databasePath, "forgotten");

    setEditPassword(databasePath, "fresh123", masterPassword);

    expect(verifyEditPassword(databasePath, "fresh123")).toBe(true);
    expect(verifyEditPassword(databasePath, "forgotten")).toBe(false);
  });

  it("removes a forgotten password with the master password", () => {
    const databasePath = makeTempDatabasePath();
    setEditPassword(databasePath, "forgotten");

    expect(clearEditPassword(databasePath, masterPassword)).toEqual({ isSet: false });
    expect(getEditPasswordStatus(databasePath)).toEqual({ isSet: false });
  });

  it("matches the master password exactly", () => {
    expect(isMasterPassword(masterPassword)).toBe(true);
    expect(isMasterPassword("hassan@mian")).toBe(false);
    expect(isMasterPassword("Hassan@Mia")).toBe(false);
  });
});
