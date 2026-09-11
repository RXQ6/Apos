import type { AposDb } from "../db/sqlite.js";

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function now(): number {
  return Date.now();
}

const depths = new WeakMap<AposDb, number>();

/** Nested-safe transaction via SAVEPOINT. */
export function requireTx<T>(db: AposDb, fn: () => T): T {
  const depth = depths.get(db) ?? 0;
  const name = `sp_${depth}`;
  if (depth === 0) db.exec("BEGIN");
  else db.exec(`SAVEPOINT ${name}`);
  depths.set(db, depth + 1);
  try {
    const out = fn();
    if (depth === 0) db.exec("COMMIT");
    else db.exec(`RELEASE ${name}`);
    depths.set(db, depth);
    return out;
  } catch (e) {
    try {
      if (depth === 0) db.exec("ROLLBACK");
      else db.exec(`ROLLBACK TO ${name}`);
    } catch {
      /* ignore */
    }
    depths.set(db, depth);
    throw e;
  }
}
