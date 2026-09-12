import type { AposDb } from "../db/sqlite.js";
import { DomainError } from "./errors.js";
import { chargePayment, createPayment } from "./payment.js";
import { receiveChannelCallback, sandboxSettle, type SandboxCallbackPayload } from "./sandbox-channel.js";
import { getSetting } from "../settings.js";

export type PaymentChannelId = "sandbox" | "alipay" | "wechat";

export interface ChannelChargeResult {
  status: string;
  channel: PaymentChannelId;
  channelPayload: unknown;
}

export interface PaymentChannel {
  id: PaymentChannelId;
  /** Human label for UI. */
  label: string;
  /** Whether real credentials are configured. */
  ready(db: AposDb): boolean;
  charge(
    db: AposDb,
    input: { paymentId: string },
  ): ChannelChargeResult;
  /** Simulate/local settle only (sandbox). Real channels use async callback. */
  settle?(
    db: AposDb,
    input: { paymentId: string; outcome?: "SUCCESS" | "FAILED" },
  ): unknown;
}

const CREDENTIAL_KEYS: Record<Exclude<PaymentChannelId, "sandbox">, string> = {
  alipay: "payment.alipay.config",
  wechat: "payment.wechat.config",
};

function hasChannelCreds(db: AposDb, id: Exclude<PaymentChannelId, "sandbox">): boolean {
  const raw = getSetting(db, CREDENTIAL_KEYS[id]);
  if (!raw) return false;
  try {
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(cfg.merchantId && cfg.secret);
  } catch {
    return false;
  }
}

/**
 * Real channel charge: validates credentials present, returns checkout params.
 * Actual bank/channel call is out of process until keys are provided.
 */
function realChannelCharge(
  db: AposDb,
  paymentId: string,
  channel: Exclude<PaymentChannelId, "sandbox">,
): ChannelChargeResult {
  if (!hasChannelCreds(db, channel)) {
    throw new DomainError(
      "CHANNEL_UNAVAILABLE",
      `${channel} credentials not configured (set app_settings ${CREDENTIAL_KEYS[channel]})`,
    );
  }
  const base = chargePayment(db, paymentId, channel);
  return {
    status: base.status,
    channel,
    channelPayload: {
      ...((base.channelPayload as object) ?? {}),
      channel,
      // Hosted cashier URL placeholder — replace when real merchant app is linked.
      cashierUrl: `${channel}://cashier/${paymentId}`,
      note: "configure webhook + call channel API with merchant credentials",
    },
  };
}

export const paymentChannels: PaymentChannel[] = [
  {
    id: "sandbox",
    label: "本地沙箱",
    ready: () => true,
    charge(db, input) {
      const r = chargePayment(db, input.paymentId, "sandbox");
      return { status: r.status, channel: "sandbox", channelPayload: r.channelPayload };
    },
    settle(db, input) {
      return sandboxSettle(db, {
        paymentId: input.paymentId,
        outcome: input.outcome ?? "SUCCESS",
      });
    },
  },
  {
    id: "alipay",
    label: "支付宝（预留）",
    ready: (db) => hasChannelCreds(db, "alipay"),
    charge(db, input) {
      return realChannelCharge(db, input.paymentId, "alipay");
    },
  },
  {
    id: "wechat",
    label: "微信支付（预留）",
    ready: (db) => hasChannelCreds(db, "wechat"),
    charge(db, input) {
      return realChannelCharge(db, input.paymentId, "wechat");
    },
  },
];

export function getPaymentChannel(id: string): PaymentChannel {
  const ch = paymentChannels.find((c) => c.id === id);
  if (!ch) throw new DomainError("CHANNEL_UNAVAILABLE", id);
  return ch;
}

export function listPaymentChannels(db: AposDb) {
  return paymentChannels.map((c) => ({
    id: c.id,
    label: c.label,
    ready: c.ready(db),
    canSettle: Boolean(c.settle),
  }));
}

/** Route charge through adapter; default sandbox. */
export function chargeViaChannel(
  db: AposDb,
  input: { paymentId: string; channel?: PaymentChannelId },
): ChannelChargeResult {
  const ch = getPaymentChannel(input.channel ?? "sandbox");
  return ch.charge(db, { paymentId: input.paymentId });
}

export function settleViaChannel(
  db: AposDb,
  input: { paymentId: string; channel?: PaymentChannelId; outcome?: "SUCCESS" | "FAILED" },
): unknown {
  const ch = getPaymentChannel(input.channel ?? "sandbox");
  if (!ch.settle) {
    throw new DomainError("CHANNEL_UNAVAILABLE", `${ch.id} has no local settle`);
  }
  return ch.settle(db, input);
}

/** Webhook entry for real channels once they POST signed payloads. */
export function receiveChannelWebhook(
  db: AposDb,
  input: { payload: SandboxCallbackPayload; signature: string; secret?: string },
): unknown {
  return receiveChannelCallback(db, input);
}

export function ensurePaymentForOrder(
  db: AposDb,
  orderId: string,
  channel: PaymentChannelId = "sandbox",
): { paymentId: string; amountCents: number; status: string } {
  return createPayment(db, orderId, channel);
}
