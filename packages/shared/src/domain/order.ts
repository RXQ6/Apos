import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";
import { ensureOnShelf } from "./inventory.js";

export interface OrderLineInput {
  skuId: string;
  qty: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: string;
  payAmountCents: number;
  lines: Array<{ skuId: string; qty: number; priceCents: number; title: string }>;
}

function newId(prefix: string): string {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** pricing.quote stub: unit price only (no coupon). */
export function quoteLines(
  db: AposDb,
  items: OrderLineInput[],
): {
  lines: Array<{ skuId: string; qty: number; priceCents: number; title: string }>;
  payAmountCents: number;
  snapshot: unknown;
} {
  if (items.length === 0) throw new DomainError("CART_EMPTY", "no items");
  const lines = items.map((item) => {
    if (item.qty <= 0) throw new DomainError("QTY_INVALID", "qty must > 0");
    const sku = ensureOnShelf(db, item.skuId);
    return {
      skuId: sku.id,
      qty: item.qty,
      priceCents: sku.priceCents,
      title: sku.title,
    };
  });
  const payAmountCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
  return {
    lines,
    payAmountCents,
    snapshot: { currency: "CNY", rule: "unit_price_only", capturedAt: now() },
  };
}

function preoccupyInTx(
  db: AposDb,
  orderId: string,
  items: OrderLineInput[],
  ttlMs: number,
): void {
  const expiresAt = now() + ttlMs;
  for (const item of items) {
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
    db.prepare(
      `INSERT INTO preoccupy (id, order_id, sku_id, qty, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).run(newId("po"), orderId, item.skuId, item.qty, expiresAt, now());
  }
}

function deductInTx(db: AposDb, orderId: string): void {
  const rows = db
    .prepare(
      `SELECT id, sku_id, qty FROM preoccupy WHERE order_id = ? AND status = 'active'`,
    )
    .all(orderId) as Array<{ id: string; sku_id: string; qty: number }>;
  for (const row of rows) {
    const upd = db
      .prepare(
        `UPDATE inventory SET on_hand = on_hand - ?, preoccupied = preoccupied - ?
         WHERE sku_id = ? AND preoccupied >= ? AND on_hand >= ?`,
      )
      .run(row.qty, row.qty, row.sku_id, row.qty, row.qty);
    if (upd.changes === 0) {
      throw new DomainError("DEDUCT_FAILED", `cannot deduct ${row.sku_id}`);
    }
    db.prepare(`UPDATE preoccupy SET status = 'deducted' WHERE id = ?`).run(row.id);
  }
}

function releaseInTx(db: AposDb, orderId: string): void {
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
}

/** order.create: quote → preoccupy → persist pending_payment. */
export function createOrder(
  db: AposDb,
  input: {
    customerId: string;
    items: OrderLineInput[];
    address?: unknown;
    ttlMs?: number;
  },
): Order {
  return requireTx(db, () => {
    const orderId = newId("ord");
    const quote = quoteLines(db, input.items);
    const ttl = input.ttlMs ?? 15 * 60 * 1000;
    preoccupyInTx(db, orderId, input.items, ttl);

    const ts = now();
    db.prepare(
      `INSERT INTO orders (id, customer_id, status, pay_amount_cents, price_snapshot_json,
        address_json, expire_at, created_at, updated_at)
       VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?)`,
    ).run(
      orderId,
      input.customerId,
      quote.payAmountCents,
      JSON.stringify(quote.snapshot),
      input.address ? JSON.stringify(input.address) : null,
      ts + ttl,
      ts,
      ts,
    );
    for (const line of quote.lines) {
      db.prepare(
        `INSERT INTO order_line (id, order_id, sku_id, qty, price_cents, title)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        newId("ol"),
        orderId,
        line.skuId,
        line.qty,
        line.priceCents,
        line.title,
      );
    }
    return {
      id: orderId,
      customerId: input.customerId,
      status: "pending_payment",
      payAmountCents: quote.payAmountCents,
      lines: quote.lines,
    };
  });
}

export function getOrder(db: AposDb, orderId: string): Order {
  const row = db
    .prepare(
      `SELECT id, customer_id, status, pay_amount_cents FROM orders WHERE id = ?`,
    )
    .get(orderId) as
    | {
        id: string;
        customer_id: string;
        status: string;
        pay_amount_cents: number;
      }
    | undefined;
  if (!row) throw new DomainError("ORDER_NOT_FOUND", `order ${orderId} missing`);
  const lines = db
    .prepare(
      `SELECT sku_id, qty, price_cents, title FROM order_line WHERE order_id = ?`,
    )
    .all(orderId) as Array<{
    sku_id: string;
    qty: number;
    price_cents: number;
    title: string;
  }>;
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    payAmountCents: row.pay_amount_cents,
    lines: lines.map((l) => ({
      skuId: l.sku_id,
      qty: l.qty,
      priceCents: l.price_cents,
      title: l.title,
    })),
  };
}

/** payment success: mark paid + deduct. Idempotent if already paid. */
export function markPaidAndDeduct(db: AposDb, orderId: string): Order {
  return requireTx(db, () => {
    const order = getOrder(db, orderId);
    if (["paid", "fulfilling", "completed"].includes(order.status)) return order;
    if (order.status !== "pending_payment") {
      throw new DomainError("ORDER_NOT_PAYABLE", `order is ${order.status}`);
    }
    deductInTx(db, orderId);
    db.prepare(`UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?`).run(
      now(),
      orderId,
    );
    return getOrder(db, orderId);
  });
}

export function cancelOrder(
  db: AposDb,
  orderId: string,
  reason: "user" | "timeout" = "user",
): Order {
  return requireTx(db, () => {
    const order = getOrder(db, orderId);
    if (["cancelled", "closed"].includes(order.status)) return order;
    if (order.status !== "pending_payment") {
      throw new DomainError(
        "ORDER_ALREADY_PAID",
        `cannot cancel ${order.status} order (${reason})`,
      );
    }
    releaseInTx(db, orderId);
    const next = reason === "timeout" ? "closed" : "cancelled";
    db.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`).run(
      next,
      now(),
      orderId,
    );
    return getOrder(db, orderId);
  });
}

export function listOrders(db: AposDb, customerId: string): Order[] {
  const rows = db
    .prepare(`SELECT id FROM orders WHERE customer_id = ? ORDER BY created_at DESC`)
    .all(customerId) as Array<{ id: string }>;
  return rows.map((r) => getOrder(db, r.id));
}
