import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chargeViaChannel,
  createOrder,
  createPayment,
  DomainError,
  listPaymentChannels,
  openAposDb,
  setSetting,
  settleViaChannel,
  upsertSku,
  type AposDb,
} from "../src/index.js";

let dir: string;
let db: AposDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "apos-ch-"));
  db = openAposDb(join(dir, "data.db"));
});

afterEach(() => {
  try {
    db.close();
  } catch {
    /* ignore */
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("payment channel adapter", () => {
  it("lists sandbox ready and real channels not ready without creds", () => {
    const list = listPaymentChannels(db);
    expect(list.find((c) => c.id === "sandbox")?.ready).toBe(true);
    expect(list.find((c) => c.id === "alipay")?.ready).toBe(false);
  });

  it("sandbox charge+settle via adapter", () => {
    upsertSku(db, { id: "sku_ch", title: "CH", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_ch", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const charged = chargeViaChannel(db, { paymentId: pay.paymentId });
    expect(charged.channel).toBe("sandbox");
    const settled = settleViaChannel(db, { paymentId: pay.paymentId }) as {
      orderStatus: string;
    };
    expect(settled.orderStatus).toBe("paid");
  });

  it("alipay without creds throws CHANNEL_UNAVAILABLE", () => {
    upsertSku(db, { id: "sku_ch2", title: "CH2", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_ch2", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    expect(() => chargeViaChannel(db, { paymentId: pay.paymentId, channel: "alipay" })).toThrowError(
      expect.objectContaining({ code: "CHANNEL_UNAVAILABLE" }),
    );
  });

  it("alipay with creds returns cashier payload", () => {
    setSetting(
      db,
      "payment.alipay.config",
      JSON.stringify({ merchantId: "m1", secret: "s1" }),
    );
    expect(listPaymentChannels(db).find((c) => c.id === "alipay")?.ready).toBe(true);
    upsertSku(db, { id: "sku_ch3", title: "CH3", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_ch3", qty: 1 }],
    });
    const pay = createPayment(db, o.id, "alipay");
    const r = chargeViaChannel(db, { paymentId: pay.paymentId, channel: "alipay" });
    expect(r.channel).toBe("alipay");
    expect((r.channelPayload as { cashierUrl?: string }).cashierUrl).toContain("alipay://");
  });
});
