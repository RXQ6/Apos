import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AposDb } from "../db/sqlite.js";
import { DomainError, now } from "./errors.js";

function hashPassword(password: string, salt: Buffer): string {
  return scryptSync(password, salt, 32).toString("hex");
}

export function registerCustomer(
  db: AposDb,
  input: { account: string; password: string },
): { customerId: string; sessionToken: string } {
  if (!input.account?.trim()) throw new DomainError("BAD_ARGS", "account required");
  if (!input.password || input.password.length < 6) {
    throw new DomainError("WEAK_PASSWORD", "password min length 6");
  }
  const exists = db
    .prepare(`SELECT id FROM customer WHERE account = ?`)
    .get(input.account) as { id: string } | undefined;
  if (exists) throw new DomainError("ACCOUNT_EXISTS", input.account);
  const salt = randomBytes(16);
  const id = `cus_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO customer (id, account, password_hash, password_salt, member_level, created_at)
     VALUES (?, ?, ?, ?, 'base', ?)`,
  ).run(id, input.account, hashPassword(input.password, salt), salt.toString("hex"), now());
  const sessionToken = loginCustomer(db, {
    account: input.account,
    password: input.password,
  }).sessionToken;
  return { customerId: id, sessionToken };
}

export function loginCustomer(
  db: AposDb,
  input: { account: string; password: string },
): { customerId: string; sessionToken: string } {
  const row = db
    .prepare(`SELECT id, password_hash, password_salt FROM customer WHERE account = ?`)
    .get(input.account) as
    | { id: string; password_hash: string; password_salt: string }
    | undefined;
  if (!row) throw new DomainError("AUTH_FAILED", "invalid credentials");
  const salt = Buffer.from(row.password_salt, "hex");
  const hash = Buffer.from(hashPassword(input.password, salt), "hex");
  const expect = Buffer.from(row.password_hash, "hex");
  if (hash.length !== expect.length || !timingSafeEqual(hash, expect)) {
    throw new DomainError("AUTH_FAILED", "invalid credentials");
  }
  const token = randomBytes(24).toString("hex");
  db.prepare(
    `INSERT INTO customer_session (token, customer_id, created_at, revoked)
     VALUES (?, ?, ?, 0)`,
  ).run(token, row.id, now());
  return { customerId: row.id, sessionToken: token };
}

export function logoutCustomer(db: AposDb, sessionToken: string): void {
  db.prepare(`UPDATE customer_session SET revoked = 1 WHERE token = ?`).run(sessionToken);
}

export function resolveCustomer(
  db: AposDb,
  sessionToken: string,
): { customerId: string; memberLevel: string } {
  const row = db
    .prepare(
      `SELECT s.customer_id, c.member_level FROM customer_session s
       JOIN customer c ON c.id = s.customer_id
       WHERE s.token = ? AND s.revoked = 0`,
    )
    .get(sessionToken) as { customer_id: string; member_level: string } | undefined;
  if (!row) throw new DomainError("AUTH_FAILED", "session invalid");
  return { customerId: row.customer_id, memberLevel: row.member_level };
}

export function saveAddress(
  db: AposDb,
  customerId: string,
  input: {
    receiver: string;
    phone: string;
    detail: string;
    isDefault?: boolean;
  },
): string {
  if (!input.receiver || !input.detail) {
    throw new DomainError("ADDRESS_INVALID", "receiver/detail required");
  }
  const id = `addr_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO address (id, customer_id, receiver, phone, detail, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    customerId,
    input.receiver,
    input.phone ?? "",
    input.detail,
    input.isDefault ? 1 : 0,
    now(),
  );
  return id;
}

export function listAddresses(db: AposDb, customerId: string) {
  return db
    .prepare(
      `SELECT id, receiver, phone, detail, is_default FROM address
       WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC`,
    )
    .all(customerId) as Array<{
    id: string;
    receiver: string;
    phone: string;
    detail: string;
    is_default: number;
  }>;
}

export function getCustomer(db: AposDb, customerId: string) {
  const row = db
    .prepare(`SELECT id, account, member_level FROM customer WHERE id = ?`)
    .get(customerId) as
    | { id: string; account: string; member_level: string }
    | undefined;
  if (!row) throw new DomainError("CUSTOMER_NOT_FOUND", customerId);
  return {
    id: row.id,
    account: row.account,
    memberLevel: row.member_level,
  };
}

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
