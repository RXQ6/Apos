import { createHmac, timingSafeEqual } from "node:crypto";
import type { AposDb } from "../db/sqlite.js";
import { DomainError, now } from "./errors.js";
import { getSetting } from "../settings.js";
import { paymentCallbackSuccess, paymentFail } from "./payment.js";

export const SANDBOX_CHANNEL = "sandbox";
export const DEFAULT_SANDBOX_SECRET = "apos-sandbox-dev-secret";
export const SANDBOX_SECRET_SETTING = "payment.sandbox.secret";

export type SandboxCallbackStatus = "SUCCESS" | "FAILED";

export interface SandboxCallbackPayload {
  channel: typeof SANDBOX_CHANNEL;
  paymentId: string;
  channelTxId: string;
  amountCents: number;
  status: SandboxCallbackStatus;
  timestamp: number;
}

export function getSandboxSecret(db?: AposDb): string {
  if (db) {
    const stored = getSetting(db, SANDBOX_SECRET_SETTING);
    if (stored) return stored;
  }
  return process.env.APOS_SANDBOX_SECRET || DEFAULT_SANDBOX_SECRET;
}

/** Fixed field order — do not reorder without invalidating signatures. */
export function canonicalSandboxString(payload: SandboxCallbackPayload): string {
  return [
    `amountCents=${payload.amountCents}`,
    `channel=${SANDBOX_CHANNEL}`,
    `channelTxId=${payload.channelTxId}`,
    `paymentId=${payload.paymentId}`,
    `status=${payload.status}`,
    `timestamp=${payload.timestamp}`,
  ].join("\n");
}

export function sandboxSign(
  payload: SandboxCallbackPayload,
  secret = DEFAULT_SANDBOX_SECRET,
): string {
  return createHmac("sha256", secret)
    .update(canonicalSandboxString(payload), "utf8")
    .digest("hex");
}

export function sandboxVerify(
  payload: SandboxCallbackPayload,
  signature: string,
  secret = DEFAULT_SANDBOX_SECRET,
): void {
  if (payload.channel !== SANDBOX_CHANNEL) {
    throw new DomainError("SIGN_INVALID", `unsupported channel ${payload.channel}`);
  }
  const expected = Buffer.from(sandboxSign(payload, secret), "hex");
  const provided = Buffer.from(String(signature ?? ""), "hex");
  if (
    expected.length === 0 ||
    provided.length !== expected.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new DomainError("SIGN_INVALID", "sandbox callback signature mismatch");
  }
}

/** Merchant-side sole settlement entry after signature check. */
export function receiveChannelCallback(
  db: AposDb,
  input: { payload: SandboxCallbackPayload; signature: string; secret?: string },
): { orderId: string; orderStatus: string } | { paymentId: string; status: string } {
  const secret = input.secret ?? getSandboxSecret(db);
  sandboxVerify(input.payload, input.signature, secret);
  if (input.payload.status === "FAILED") {
    const failed = paymentFail(db, input.payload.paymentId);
    return { paymentId: input.payload.paymentId, status: failed.status };
  }
  return paymentCallbackSuccess(db, {
    paymentId: input.payload.paymentId,
    channelTxId: input.payload.channelTxId,
    amountCents: input.payload.amountCents,
  });
}

/**
 * Channel-side simulator: mint a tx id, sign, and deliver callback.
 * outcome=FAILED marks payment failed without touching inventory.
 */
export function sandboxSettle(
  db: AposDb,
  input: {
    paymentId: string;
    outcome?: SandboxCallbackStatus;
    secret?: string;
    channelTxId?: string;
    timestamp?: number;
  },
):
  | { orderId: string; orderStatus: string }
  | { paymentId: string; status: string } {
  const pay = db
    .prepare(`SELECT id, order_id, amount_cents, status FROM payment WHERE id = ?`)
    .get(input.paymentId) as
    | { id: string; order_id: string; amount_cents: number; status: string }
    | undefined;
  if (!pay) throw new DomainError("UNKNOWN_PAYMENT", input.paymentId);
  if (pay.status === "success") {
    const order = db
      .prepare(`SELECT id, status FROM orders WHERE id = ?`)
      .get(pay.order_id) as { id: string; status: string } | undefined;
    return {
      orderId: order?.id ?? pay.order_id,
      orderStatus: order?.status ?? "paid",
    };
  }
  if (pay.status === "closed") {
    throw new DomainError("PAYMENT_ALREADY_SUCCESS", `payment closed: ${input.paymentId}`);
  }

  const outcome = input.outcome ?? "SUCCESS";
  const payload: SandboxCallbackPayload = {
    channel: SANDBOX_CHANNEL,
    paymentId: pay.id,
    channelTxId:
      input.channelTxId ?? `sbx_${now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    amountCents: pay.amount_cents,
    status: outcome,
    timestamp: input.timestamp ?? now(),
  };
  const signature = sandboxSign(payload, input.secret ?? getSandboxSecret(db));
  return receiveChannelCallback(db, {
    payload,
    signature,
    secret: input.secret,
  });
}
