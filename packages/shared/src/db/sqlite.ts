/**
 * SQLite access via Node built-in `node:sqlite` (Node ≥ 22.5).
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { APOS_SCHEMA_SQL } from "./schema.js";

export type AposDb = DatabaseSync;

export function openAposDb(dataDbPath: string): AposDb {
  mkdirSync(dirname(dataDbPath), { recursive: true });
  const db = new DatabaseSync(dataDbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(APOS_SCHEMA_SQL);
  return db;
}

export function insertSession(
  db: AposDb,
  row: {
    id: string;
    title: string;
    permissionMode: string;
    createdAt: number;
    updatedAt: number;
  },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO sessions (id, title, permission_mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.id, row.title, row.permissionMode, row.createdAt, row.updatedAt);
}

export function insertMessage(
  db: AposDb,
  row: { sessionId: string; role: string; text: string; ts: number },
): void {
  db.prepare(
    `INSERT INTO session_messages (session_id, role, text, ts) VALUES (?, ?, ?, ?)`,
  ).run(row.sessionId, row.role, row.text, row.ts);
}

export function listSessions(db: AposDb): Array<{
  id: string;
  title: string;
  permission_mode: string;
  updated_at: number;
}> {
  return db
    .prepare(
      `SELECT id, title, permission_mode, updated_at FROM sessions ORDER BY updated_at DESC`,
    )
    .all() as unknown as Array<{
    id: string;
    title: string;
    permission_mode: string;
    updated_at: number;
  }>;
}

export function upsertFeatureState(
  db: AposDb,
  featureId: string,
  status: string,
  verifyCmd: string,
): void {
  db.prepare(
    `INSERT OR REPLACE INTO feature_state (feature_id, harness_status, verify_cmd, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(featureId, status, verifyCmd, Date.now());
}
