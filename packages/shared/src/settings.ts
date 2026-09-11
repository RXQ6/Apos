import type { AposDb } from "./db/sqlite.js";

export function setSetting(db: AposDb, key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function getSetting(db: AposDb, key: string): string | undefined {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setProvidersJson(db: AposDb, json: string): void {
  setSetting(db, "providers_json", json);
}

export function getProvidersJson(db: AposDb): string | undefined {
  return getSetting(db, "providers_json");
}
