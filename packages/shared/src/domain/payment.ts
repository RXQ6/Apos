import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";
import { cancelOrder, getOrder, markPaidAndDeduct } from "./order.js";
import { emit } from "./events.js";

export function createPayment(
  db: AposDb,
  orderId: string,
  channel = "sandbox",
): { paymentId: string; amountCents: number; status: string } {
  const order = getOrder(db, orderId);
  if (order.status !== "pending_payment") {
    throw new DomainError("ORDER_NOT_PAYABLE", order.status);
  }
  const existing = db
    .prepare(
      `SELECT id, amount_cents, status FROM payment
       WHERE order_id = ? AND status IN ('created','paying') ORDER BY created_at DESC LIMIT 1`,
    )
    .get(orderId) as
    | { id: string; amount_cents: number; status: string }
    | undefined;
  if (existing) {
    return {
      paymentId: existing.id,
      amountCents: existing.amount_cents,
      status: existing.status,
    };
  }
  const id = `pay_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO payment (id, order_id, amount_cents, channel, status, created_at)
     VALUES (?, ?, ?, ?, 'created', ?)`,
  ).run(id, orderId, order.payAmountCents, channel, now());
  return { paymentId: id, amountCents: order.payAmountCents, status: "created" };
}

export function chargePayment(
  db: AposDb,
  paymentId: string,
  channel = "sandbox",
): { status: string; channelPayload: unknown } {
  const row = db
    .prepare(`SELECT id, order_id, amount_cents, status FROM payment WHERE id = ?`)
    .get(paymentId) as
    | { id: string; order_id: string; amount_cents: number; status: string }
    | undefined;
  if (!row) throw new DomainError("PAYMENT_NOT_FOUND", paymentId);
  if (row.status === "success") {
    return { status: "success", channelPayload: { alreadyPaid: true } };
  }
  if (row.status === "closed") {
    throw new DomainError("PAYMENT_ALREADY_SUCCESS", paymentId);
  }
  const resolved = channel || "sandbox";
  db.prepare(`UPDATE payment SET status = 'paying', channel = ? WHERE id = ?`).run(
    resolved,
    paymentId,
  );
  return {
    status: "paying",
    channelPayload: {
      channel: resolved,
      sandboxPayUrl: `sandbox://pay/${paymentId}`,
      amountCents: row.amount_cents,
      hint: "complete via sandboxSettle → receiveChannelCallback (signed)",
    },
  };
}

export function paymentCallbackSuccess(
  db: AposDb,
  input: { paymentId: string; channelTxId: string; amountCents?: number },
): { orderId: string; orderStatus: string } {
  return requireTx(db, () => {
    const pay = db
      .prepare(`SELECT id, order_id, amount_cents, status FROM payment WHERE id = ?`)
      .get(input.paymentId) as
      | { id: string; order_id: string; amount_cents: number; status: string }
      | undefined;
    if (!pay) throw new DomainError("UNKNOWN_PAYMENT", input.paymentId);
    if (pay.status === "closed") {
      throw new DomainError("PAYMENT_CLOSED", `payment ${input.paymentId} already closed`);
    }
    if (input.amountCents !== undefined && input.amountCents !== pay.amount_cents) {
      throw new DomainError("AMOUNT_MISMATCH", "callback amount mismatch");
    }
    const seen = db
      .prepare(`SELECT id FROM payment_tx WHERE channel_tx_id = ?`)
      .get(input.channelTxId) as { id: string } | undefined;
    if (seen) {
      const order = getOrder(db, pay.order_id);
      return { orderId: order.id, orderStatus: order.status };
    }
    db.prepare(
      `INSERT INTO payment_tx (id, payment_id, channel_tx_id, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      `tx_${now().toString(36)}`,
      pay.id,
      input.channelTxId,
      JSON.stringify(input),
      now(),
    );
    db.prepare(`UPDATE payment SET status = 'success' WHERE id = ?`).run(pay.id);
    const order = markPaidAndDeduct(db, pay.order_id);
    emit("payment.succeeded", { paymentId: pay.id, orderId: order.id });
    emit("order.paid", { orderId: order.id });
    return { orderId: order.id, orderStatus: order.status };
  });
}

export function paymentFail(db: AposDb, paymentId: string): { status: string } {
  db.prepare(
    `UPDATE payment SET status = 'failed' WHERE id = ? AND status != 'success'`,
  ).run(paymentId);
  emit("payment.failed", { paymentId });
  return { status: "failed" };
}

export function paymentTimeoutClose(
  db: AposDb,
  paymentId: string,
): { paymentStatus: string; orderId: string; orderStatus: string } {
  return requireTx(db, () => {
    const pay = db
      .prepare(`SELECT id, order_id, status FROM payment WHERE id = ?`)
      .get(paymentId) as { id: string; order_id: string; status: string } | undefined;
    if (!pay) throw new DomainError("PAYMENT_NOT_FOUND", paymentId);
    if (pay.status === "success") {
      throw new DomainError("PAYMENT_ALREADY_SUCCESS", paymentId);
    }
    if (pay.status === "closed") {
      const order = getOrder(db, pay.order_id);
      return {
        paymentStatus: "closed",
        orderId: order.id,
        orderStatus: order.status,
      };
    }
    db.prepare(`UPDATE payment SET status = 'closed' WHERE id = ?`).run(paymentId);
    const order = cancelOrder(db, pay.order_id, "timeout");
    emit("order.cancelled", { orderId: order.id, reason: "timeout" });
    return {
      paymentStatus: "closed",
      orderId: order.id,
      orderStatus: order.status,
    };
  });
}

/**
 * Close pending orders past expire_at: close non-success payments, cancel order (release stock).
 * Idempotent; paid orders are skipped.
 */
export function sweepTimeoutOrders(
  db: AposDb,
  at = now(),
): Array<{ orderId: string; orderStatus: string; closedPayments: number }> {
  const rows = db
    .prepare(
      `SELECT id FROM orders
       WHERE status = 'pending_payment' AND expire_at IS NOT NULL AND expire_at <= ?`,
    )
    .all(at) as Array<{ id: string }>;
  const out: Array<{ orderId: string; orderStatus: string; closedPayments: number }> = [];
  for (const row of rows) {
    out.push(
      requireTx(db, () => {
        const pays = db
          .prepare(
            `SELECT id, status FROM payment WHERE order_id = ? AND status != 'success'`,
          )
          .all(row.id) as Array<{ id: string; status: string }>;
        let closed = 0;
        for (const p of pays) {
          if (p.status === "closed") continue;
          db.prepare(`UPDATE payment SET status = 'closed' WHERE id = ?`).run(p.id);
          closed += 1;
        }
        const order = cancelOrder(db, row.id, "timeout");
        if (order.status === "closed") {
          emit("order.cancelled", { orderId: order.id, reason: "timeout" });
        }
        return { orderId: order.id, orderStatus: order.status, closedPayments: closed };
      }),
    );
  }
  return out;
}

export function createRefund(
  db: AposDb,
  input: { aftersaleId: string; paymentId: string; amountCents: number },
): { refundId: string; status: string } {
  if (input.amountCents <= 0) {
    throw new DomainError("AMOUNT_EXCEEDS_PAID", "refund amount must > 0");
  }
  const pay = db
    .prepare(`SELECT amount_cents, status FROM payment WHERE id = ?`)
    .get(input.paymentId) as { amount_cents: number; status: string } | undefined;
  if (!pay || pay.status !== "success") {
    throw new DomainError("PAYMENT_NOT_SUCCESS", input.paymentId);
  }
  if (input.amountCents > pay.amount_cents) {
    throw new DomainError("AMOUNT_EXCEEDS_PAID", "refund > paid");
  }
  const existing = db
    .prepare(`SELECT id, status FROM refund WHERE aftersale_id = ?`)
    .get(input.aftersaleId) as { id: string; status: string } | undefined;
  if (existing) return { refundId: existing.id, status: existing.status };
  const id = `rf_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO refund (id, aftersale_id, payment_id, amount_cents, status, created_at)
     VALUES (?, ?, ?, ?, 'success', ?)`,
  ).run(id, input.aftersaleId, input.paymentId, input.amountCents, now());
  emit("payment.refunded", { refundId: id, aftersaleId: input.aftersaleId });
  return { refundId: id, status: "success" };
}

/** order.repay: reuse open payment or create+charge for pending order. */
export function repayOrder(
  db: AposDb,
  orderId: string,
  channel = "sandbox",
): {
  paymentId: string;
  status: string;
  channelPayload: unknown;
  amountCents: number;
} {
  const order = getOrder(db, orderId);
  if (order.status !== "pending_payment") {
    throw new DomainError("ORDER_NOT_PAYABLE", order.status);
  }
  const pay = createPayment(db, orderId, channel);
  const charged = chargePayment(db, pay.paymentId, channel);
  return {
    paymentId: pay.paymentId,
    status: charged.status,
    channelPayload: charged.channelPayload,
    amountCents: pay.amountCents,
  };
}
