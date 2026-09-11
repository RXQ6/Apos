import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";

export interface Sku {
  id: string;
  title: string;
  priceCents: number;
  status: "draft" | "on_shelf" | "off_shelf";
}

export function upsertSku(
  db: AposDb,
  sku: { id: string; title: string; priceCents: number; onHand?: number },
): Sku {
  const ts = now();
  db.prepare(
    `INSERT INTO sku (id, title, price_cents, status) VALUES (?, ?, ?, 'on_shelf')
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, price_cents=excluded.price_cents`,
  ).run(sku.id, sku.title, sku.priceCents);
  if (sku.onHand !== undefined) {
    db.prepare(
      `INSERT INTO inventory (sku_id, on_hand, preoccupied) VALUES (?, ?, 0)
       ON CONFLICT(sku_id) DO UPDATE SET on_hand=excluded.on_hand
       WHERE inventory.preoccupied <= excluded.on_hand`,
    ).run(sku.id, sku.onHand);
  }
  void ts;
  return getSku(db, sku.id);
}

export function getSku(db: AposDb, id: string): Sku {
  const row = db
    .prepare(`SELECT id, title, price_cents, status FROM sku WHERE id = ?`)
    .get(id) as
    | { id: string; title: string; price_cents: number; status: Sku["status"] }
    | undefined;
  if (!row) throw new DomainError("SKU_NOT_FOUND", `sku ${id} not found`);
  return {
    id: row.id,
    title: row.title,
    priceCents: row.price_cents,
    status: row.status,
  };
}

export function ensureOnShelf(db: AposDb, id: string): Sku {
  const sku = getSku(db, id);
  if (sku.status !== "on_shelf") {
    throw new DomainError("ITEM_OFF_SHELF", `sku ${id} is ${sku.status}`);
  }
  return sku;
}

export function getStock(
  db: AposDb,
  skuId: string,
): { onHand: number; preoccupied: number; available: number } {
  const row = db
    .prepare(`SELECT on_hand, preoccupied FROM inventory WHERE sku_id = ?`)
    .get(skuId) as { on_hand: number; preoccupied: number } | undefined;
  if (!row) throw new DomainError("SKU_NOT_FOUND", `inventory ${skuId} missing`);
  return {
    onHand: row.on_hand,
    preoccupied: row.preoccupied,
    available: row.on_hand - row.preoccupied,
  };
}

/**
 * Atomic preoccupy: UPDATE only when available >= qty.
 * All-or-nothing for multi-SKU via outer requireTx.
 */
export function preoccupyItems(
  db: AposDb,
  orderId: string,
  items: Array<{ skuId: string; qty: number }>,
  ttlMs = 15 * 60 * 1000,
): Array<{ preoccupyId: string; skuId: string; qty: number; expiresAt: number }> {
  if (items.length === 0) throw new DomainError("CART_EMPTY", "no items");
  return requireTx(db, () => {
    const expiresAt = now() + ttlMs;
    const out: Array<{ preoccupyId: string; skuId: string; qty: number; expiresAt: number }> =
      [];
    for (const item of items) {
      if (item.qty <= 0) throw new DomainError("QTY_INVALID", "qty must > 0");
      ensureOnShelf(db, item.skuId);
      const upd = db
        .prepare(
          `UPDATE inventory SET preoccupied = preoccupied + ?
           WHERE sku_id = ? AND (on_hand - preoccupied) >= ?`,
        )
        .run(item.qty, item.skuId, item.qty);
      if (upd.changes === 0) {
        throw new DomainError(
          "STOCK_INSUFFICIENT",
          `insufficient stock for ${item.skuId}`,
        );
      }
      const id = `po_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        `INSERT INTO preoccupy (id, order_id, sku_id, qty, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      ).run(id, orderId, item.skuId, item.qty, expiresAt, now());
      out.push({ preoccupyId: id, skuId: item.skuId, qty: item.qty, expiresAt });
    }
    return out;
  });
}

export function deductByOrder(db: AposDb, orderId: string): number {
  return requireTx(db, () => {
    const rows = db
      .prepare(
        `SELECT id, sku_id, qty FROM preoccupy WHERE order_id = ? AND status = 'active'`,
      )
      .all(orderId) as Array<{ id: string; sku_id: string; qty: number }>;
    let n = 0;
    for (const row of rows) {
      const upd = db
        .prepare(
          `UPDATE inventory SET on_hand = on_hand - ?, preoccupied = preoccupied - ?
           WHERE sku_id = ? AND preoccupied >= ? AND on_hand >= ?`,
        )
        .run(row.qty, row.qty, row.sku_id, row.qty, row.qty);
      if (upd.changes === 0) {
        throw new DomainError(
          "DEDUCT_FAILED",
          `cannot deduct ${row.sku_id} for order ${orderId}`,
        );
      }
      db.prepare(`UPDATE preoccupy SET status = 'deducted' WHERE id = ?`).run(row.id);
      n += 1;
    }
    return n;
  });
}

export function releaseByOrder(db: AposDb, orderId: string): number {
  return requireTx(db, () => {
    const rows = db
      .prepare(
        `SELECT id, sku_id, qty FROM preoccupy WHERE order_id = ? AND status = 'active'`,
      )
      .all(orderId) as Array<{ id: string; sku_id: string; qty: number }>;
    for (const row of rows) {
      db.prepare(
        `UPDATE inventory SET preoccupied = preoccupied - ?
         WHERE sku_id = ? AND preoccupied >= ?`,
      ).run(row.qty, row.sku_id, row.qty);
      db.prepare(`UPDATE preoccupy SET status = 'released' WHERE id = ?`).run(row.id);
    }
    return rows.length;
  });
}

export function expirePreoccupies(db: AposDb, at = now()): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT order_id FROM preoccupy
       WHERE status = 'active' AND expires_at < ?`,
    )
    .all(at) as Array<{ order_id: string }>;
  const ids: string[] = [];
  for (const r of rows) {
    releaseByOrder(db, r.order_id);
    const ord = db
      .prepare(`SELECT status FROM orders WHERE id = ?`)
      .get(r.order_id) as { status: string } | undefined;
    if (ord?.status === "pending_payment") {
      db.prepare(
        `UPDATE orders SET status = 'closed', updated_at = ? WHERE id = ?`,
      ).run(now(), r.order_id);
    }
    ids.push(r.order_id);
  }
  return ids;
}
