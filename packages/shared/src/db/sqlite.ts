/**
 * SQLite access via Node built-in `node:sqlite` (Node ≥ 22.5).
 * When running under Bun, swap the driver to `bun:sqlite` with the same API surface.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type AposDb = DatabaseSync;

export function openAposDb(dataDbPath: string): AposDb {
  mkdirSync(dirname(dataDbPath), { recursive: true });
  const db = new DatabaseSync(dataDbPath);
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "schema.sql"),
    join(here, "..", "db", "schema.sql"),
    join(here, "..", "..", "src", "db", "schema.sql"),
  ];
  let sql: string | undefined;
  for (const p of candidates) {
    try {
      sql = readFileSync(p, "utf8");
      break;
    } catch {
      /* next */
    }
  }
  if (!sql) throw new Error("schema.sql not found");
  db.exec(sql);
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
