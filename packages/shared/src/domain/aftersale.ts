import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";
import { emit, on } from "./events.js";
import { getOrder } from "./order.js";
import { createRefund } from "./payment.js";

function id(p: string): string {
  return `${p}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function openAftersale(
  db: AposDb,
  input: {
    orderId: string;
    orderLineId?: string;
    type: "refund_only" | "return_refund";
    reason: string;
    amountCents?: number;
  },
): { aftersaleId: string; status: string } {
  const order = getOrder(db, input.orderId);
  if (!["paid", "fulfilling", "completed"].includes(order.status)) {
    throw new DomainError("ORDER_NOT_REFUNDABLE", order.status);
  }
  const line = input.orderLineId
    ? (db
        .prepare(`SELECT price_cents, qty FROM order_line WHERE id = ? AND order_id = ?`)
        .get(input.orderLineId, input.orderId) as
        | { price_cents: number; qty: number }
        | undefined)
    : undefined;
  const maxAmount =
    input.amountCents ??
    (line ? line.price_cents * line.qty : order.payAmountCents);
  if (maxAmount > order.payAmountCents) {
    throw new DomainError("AMOUNT_EXCEEDS_PAID", String(maxAmount));
  }
  const open = db
    .prepare(
      `SELECT id FROM aftersale WHERE order_id = ? AND status NOT IN ('closed','rejected')`,
    )
    .get(input.orderId) as { id: string } | undefined;
  if (open) throw new DomainError("AFTERSALE_EXISTS", open.id);
  const aid = id("as");
  db.prepare(
    `INSERT INTO aftersale (id, order_id, order_line_id, type, status, amount_cents, reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'opened', ?, ?, ?, ?)`,
  ).run(
    aid,
    input.orderId,
    input.orderLineId ?? null,
    input.type,
    maxAmount,
    input.reason ?? "",
    now(),
    now(),
  );
  emit("aftersale.opened", { aftersaleId: aid, orderId: input.orderId });
  return { aftersaleId: aid, status: "opened" };
}

export function approveAftersale(
  db: AposDb,
  aftersaleId: string,
  decision: "approved" | "rejected",
  reason?: string,
): { status: string } {
  const row = db
    .prepare(`SELECT id, type, status FROM aftersale WHERE id = ?`)
    .get(aftersaleId) as { id: string; type: string; status: string } | undefined;
  if (!row) throw new DomainError("AFTERSALE_NOT_FOUND", aftersaleId);
  if (["closed", "rejected"].includes(row.status)) {
    throw new DomainError("AFTERSALE_STATE_INVALID", row.status);
  }
  const next = decision === "rejected" ? "rejected" : "approved";
  db.prepare(`UPDATE aftersale SET status = ?, reason = ?, updated_at = ? WHERE id = ?`).run(
    next,
    reason ?? "",
    now(),
    aftersaleId,
  );
  return { status: next };
}

/** refund_only: approve → refund without stock in. */
export function refundOnly(
  db: AposDb,
  aftersaleId: string,
): { refundId: string; status: string } {
  return requireTx(db, () => {
    const row = db
      .prepare(
        `SELECT id, order_id, status, amount_cents, type FROM aftersale WHERE id = ?`,
      )
      .get(aftersaleId) as
      | {
          id: string;
          order_id: string;
          status: string;
          amount_cents: number;
          type: string;
        }
      | undefined;
    if (!row) throw new DomainError("AFTERSALE_NOT_FOUND", aftersaleId);
    if (row.type !== "refund_only") {
      throw new DomainError("AFTERSALE_TYPE_INVALID", row.type);
    }
    if (!["opened", "approved"].includes(row.status)) {
      throw new DomainError("AFTERSALE_STATE_INVALID", row.status);
    }
    const payment = db
      .prepare(
        `SELECT id FROM payment WHERE order_id = ? AND status = 'success' LIMIT 1`,
      )
      .get(row.order_id) as { id: string } | undefined;
    if (!payment) throw new DomainError("PAYMENT_NOT_SUCCESS", row.order_id);
    const refund = createRefund(db, {
      aftersaleId,
      paymentId: payment.id,
      amountCents: row.amount_cents,
    });
    db.prepare(`UPDATE aftersale SET status = 'closed', updated_at = ? WHERE id = ?`).run(
      now(),
      aftersaleId,
    );
    return refund;
  });
}

/** return_refund: must return_received before refund + stock back. */
export function returnRefund(
  db: AposDb,
  aftersaleId: string,
): { refundId: string; status: string } {
  return requireTx(db, () => {
    const row = db
      .prepare(
        `SELECT id, order_id, status, amount_cents, type, order_line_id FROM aftersale WHERE id = ?`,
      )
      .get(aftersaleId) as
      | {
          id: string;
          order_id: string;
          status: string;
          amount_cents: number;
          type: string;
          order_line_id: string | null;
        }
      | undefined;
    if (!row) throw new DomainError("AFTERSALE_NOT_FOUND", aftersaleId);
    if (row.type !== "return_refund") {
      throw new DomainError("AFTERSALE_TYPE_INVALID", row.type);
    }
    if (row.status !== "return_received") {
      throw new DomainError("RETURN_NOT_RECEIVED", row.status);
    }
    // stock back: increase on_hand for returned lines (best-effort for full return)
    const lines = row.order_line_id
      ? (db
          .prepare(`SELECT sku_id, qty FROM order_line WHERE id = ?`)
          .all(row.order_line_id) as Array<{ sku_id: string; qty: number }>)
      : (db
          .prepare(`SELECT sku_id, qty FROM order_line WHERE order_id = ?`)
          .all(row.order_id) as Array<{ sku_id: string; qty: number }>);
    for (const line of lines) {
      db.prepare(
        `UPDATE inventory SET on_hand = on_hand + ? WHERE sku_id = ?`,
      ).run(line.qty, line.sku_id);
    }
    const payment = db
      .prepare(
        `SELECT id FROM payment WHERE order_id = ? AND status = 'success' LIMIT 1`,
      )
      .get(row.order_id) as { id: string } | undefined;
    if (!payment) throw new DomainError("PAYMENT_NOT_SUCCESS", row.order_id);
    const refund = createRefund(db, {
      aftersaleId,
      paymentId: payment.id,
      amountCents: row.amount_cents,
    });
    db.prepare(`UPDATE aftersale SET status = 'closed', updated_at = ? WHERE id = ?`).run(
      now(),
      aftersaleId,
    );
    return refund;
  });
}

/** Wire return_received → auto path is manual via returnRefund after markReturnReceived. */
export function bindAftersaleEvents(db: AposDb): () => void {
  return on("aftersale.return_received", (p) => {
    void p;
    void db;
  });
}
