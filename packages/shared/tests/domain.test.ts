import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveAftersale,
  cartAdd,
  cartCheckoutReady,
  cancelOrder,
  catalogSearch,
  chargePayment,
  createOrder,
  createPayment,
  createShipment,
  createSpu,
  attachSku,
  DomainError,
  getOrCreateCart,
  getStock,
  loginCustomer,
  markPaidAndDeduct,
  markReturnReceived,
  openAftersale,
  openAposDb,
  publishSpu,
  receiveChannelCallback,
  refundOnly,
  registerCustomer,
  returnRefund,
  sandboxSettle,
  sandboxSign,
  paymentTimeoutClose,
  paymentFail,
  sweepTimeoutOrders,
  shipShipment,
  signShipment,
  upsertSku,
  type AposDb,
} from "../src/index.js";

let dir: string;
let db: AposDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "apos-test-"));
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

describe("inventory/order slice", () => {
  it("preoccupy → pay deduct → cancel release", () => {
    upsertSku(db, { id: "sku_a", title: "A", priceCents: 100, onHand: 5 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_a", qty: 2 }],
    });
    expect(getStock(db, "sku_a").available).toBe(3);
    markPaidAndDeduct(db, o.id);
    expect(getStock(db, "sku_a").onHand).toBe(3);
    expect(getStock(db, "sku_a").preoccupied).toBe(0);
  });

  it("rejects oversell", () => {
    upsertSku(db, { id: "sku_b", title: "B", priceCents: 100, onHand: 1 });
    createOrder(db, { customerId: "c", items: [{ skuId: "sku_b", qty: 1 }] });
    expect(() =>
      createOrder(db, { customerId: "c", items: [{ skuId: "sku_b", qty: 1 }] }),
    ).toThrowError(DomainError);
  });

  it("cancel releases preoccupy", () => {
    upsertSku(db, { id: "sku_c", title: "C", priceCents: 50, onHand: 3 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_c", qty: 2 }],
    });
    cancelOrder(db, o.id, "user");
    expect(getStock(db, "sku_c").available).toBe(3);
  });
});

describe("cart → checkout → order", () => {
  it("checked lines produce batch and order", () => {
    upsertSku(db, { id: "sku_x", title: "X", priceCents: 200, onHand: 5 });
    const cart = getOrCreateCart(db, "user", "u1");
    cartAdd(db, cart.id, "sku_x", 2);
    const ready = cartCheckoutReady(db, cart.id);
    expect(ready.payAmountCents).toBe(400);
    const order = createOrder(db, {
      customerId: "u1",
      items: ready.items.map((i) => ({ skuId: i.skuId, qty: i.qty })),
    });
    expect(order.payAmountCents).toBe(400);
  });
});

describe("customer + catalog + payment + aftersale e2e", () => {
  it("full happy path refund_only and return_refund", () => {
    const reg = registerCustomer(db, { account: "a@b.c", password: "secret1" });
    const login = loginCustomer(db, { account: "a@b.c", password: "secret1" });
    expect(login.customerId).toBe(reg.customerId);

    const spu = createSpu(db, { title: "苹果" });
    const sku = attachSku(db, spu, { title: "苹果", priceCents: 1000, onHand: 10 });
    publishSpu(db, spu);
    expect(catalogSearch(db, { q: "苹果" }).length).toBeGreaterThan(0);

    const o = createOrder(db, {
      customerId: reg.customerId,
      items: [{ skuId: sku, qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const cb = sandboxSettle(db, { paymentId: pay.paymentId, channelTxId: "tx1" }) as {
      orderStatus: string;
    };
    expect(cb.orderStatus).toBe("paid");
    // idempotent settle
    const cb2 = sandboxSettle(db, { paymentId: pay.paymentId, channelTxId: "tx1" }) as {
      orderStatus: string;
    };
    expect(cb2.orderStatus).toBe("paid");

    // refund only
    const open = openAftersale(db, {
      orderId: o.id,
      type: "refund_only",
      reason: "damaged",
      amountCents: 1000,
    });
    approveAftersale(db, open.aftersaleId, "approved");
    const rf = refundOnly(db, open.aftersaleId);
    expect(rf.status).toBe("success");

    // second order for return_refund
    const o2 = createOrder(db, {
      customerId: reg.customerId,
      items: [{ skuId: sku, qty: 2 }],
    });
    const pay2 = createPayment(db, o2.id);
    sandboxSettle(db, { paymentId: pay2.paymentId, channelTxId: "tx2" });
    const shp = createShipment(db, { orderId: o2.id });
    shipShipment(db, { shipmentId: shp, carrier: "SF", trackingNo: "T1" });
    signShipment(db, shp);
    const open2 = openAftersale(db, {
      orderId: o2.id,
      type: "return_refund",
      reason: "return",
    });
    approveAftersale(db, open2.aftersaleId, "approved");
    // must not refund before receive
    expect(() => returnRefund(db, open2.aftersaleId)).toThrowError(DomainError);
    markReturnReceived(db, open2.aftersaleId);
    const rf2 = returnRefund(db, open2.aftersaleId);
    expect(rf2.status).toBe("success");
  });
});

describe("payment sandbox channel", () => {
  it("charge returns sandbox pay url, not mock", () => {
    upsertSku(db, { id: "sku_s1", title: "S1", priceCents: 100, onHand: 2 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_s1", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const charged = chargePayment(db, pay.paymentId);
    expect(charged.status).toBe("paying");
    const payload = charged.channelPayload as { sandboxPayUrl?: string; mockPayUrl?: string };
    expect(payload.sandboxPayUrl).toContain("sandbox://pay/");
    expect(payload.mockPayUrl).toBeUndefined();
  });

  it("rejects invalid signature without deducting", () => {
    upsertSku(db, { id: "sku_s2", title: "S2", priceCents: 100, onHand: 2 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_s2", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const body = {
      payload: {
        channel: "sandbox" as const,
        paymentId: pay.paymentId,
        channelTxId: "bad-tx",
        amountCents: pay.amountCents,
        status: "SUCCESS" as const,
        timestamp: 1,
      },
      signature: "deadbeef",
    };
    expect(() => receiveChannelCallback(db, body)).toThrowError(
      expect.objectContaining({ code: "SIGN_INVALID" }),
    );
    expect(getStock(db, "sku_s2").onHand).toBe(2);
    expect(getStock(db, "sku_s2").preoccupied).toBe(1);
  });

  it("accepts valid signed callback and is idempotent on channelTxId", () => {
    upsertSku(db, { id: "sku_s3", title: "S3", priceCents: 50, onHand: 3 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_s3", qty: 2 }],
    });
    const pay = createPayment(db, o.id);
    const payload = {
      channel: "sandbox" as const,
      paymentId: pay.paymentId,
      channelTxId: "signed-1",
      amountCents: pay.amountCents,
      status: "SUCCESS" as const,
      timestamp: 42,
    };
    const signature = sandboxSign(payload);
    const r1 = receiveChannelCallback(db, { payload, signature }) as {
      orderStatus: string;
    };
    expect(r1.orderStatus).toBe("paid");
    expect(getStock(db, "sku_s3").onHand).toBe(1);
    expect(getStock(db, "sku_s3").preoccupied).toBe(0);

    const r2 = receiveChannelCallback(db, { payload, signature }) as {
      orderStatus: string;
    };
    expect(r2.orderStatus).toBe("paid");
    expect(getStock(db, "sku_s3").onHand).toBe(1);
  });

  it("rejects amount mismatch after valid signature", () => {
    upsertSku(db, { id: "sku_s4", title: "S4", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_s4", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const payload = {
      channel: "sandbox" as const,
      paymentId: pay.paymentId,
      channelTxId: "amt-1",
      amountCents: pay.amountCents + 1,
      status: "SUCCESS" as const,
      timestamp: 7,
    };
    const signature = sandboxSign(payload);
    expect(() => receiveChannelCallback(db, { payload, signature })).toThrowError(
      expect.objectContaining({ code: "AMOUNT_MISMATCH" }),
    );
  });

  it("sandbox settle FAILED marks payment failed and keeps stock", () => {
    upsertSku(db, { id: "sku_s5", title: "S5", priceCents: 80, onHand: 4 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_s5", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    const r = sandboxSettle(db, { paymentId: pay.paymentId, outcome: "FAILED" }) as {
      status: string;
    };
    expect(r.status).toBe("failed");
    expect(getStock(db, "sku_s5").preoccupied).toBe(1);
    expect(getStock(db, "sku_s5").onHand).toBe(4);
  });
});

describe("timeout close + fail retry", () => {
  it("timeout closes payment, order, and releases preoccupy", () => {
    upsertSku(db, { id: "sku_t1", title: "T1", priceCents: 100, onHand: 2 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t1", qty: 2 }],
    });
    const pay = createPayment(db, o.id);
    chargePayment(db, pay.paymentId);
    const r = paymentTimeoutClose(db, pay.paymentId);
    expect(r.paymentStatus).toBe("closed");
    expect(r.orderStatus).toBe("closed");
    expect(getStock(db, "sku_t1").preoccupied).toBe(0);
    expect(getStock(db, "sku_t1").available).toBe(2);
    // idempotent
    const r2 = paymentTimeoutClose(db, pay.paymentId);
    expect(r2.orderStatus).toBe("closed");
  });

  it("rejects SUCCESS callback after payment closed", () => {
    upsertSku(db, { id: "sku_t2", title: "T2", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t2", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    paymentTimeoutClose(db, pay.paymentId);
    expect(() =>
      sandboxSettle(db, { paymentId: pay.paymentId, channelTxId: "late-1" }),
    ).toThrowError(expect.objectContaining({ code: "PAYMENT_CLOSED" }));
    expect(getStock(db, "sku_t2").onHand).toBe(1);
  });

  it("does not timeout-close an already paid payment", () => {
    upsertSku(db, { id: "sku_t3", title: "T3", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t3", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    sandboxSettle(db, { paymentId: pay.paymentId });
    expect(() => paymentTimeoutClose(db, pay.paymentId)).toThrowError(
      expect.objectContaining({ code: "PAYMENT_ALREADY_SUCCESS" }),
    );
    expect(getStock(db, "sku_t3").onHand).toBe(0);
  });

  it("fail then retry charge then success deducts once", () => {
    upsertSku(db, { id: "sku_t4", title: "T4", priceCents: 100, onHand: 3 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t4", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    sandboxSettle(db, { paymentId: pay.paymentId, outcome: "FAILED", channelTxId: "f1" });
    const again = chargePayment(db, pay.paymentId);
    expect(again.status).toBe("paying");
    sandboxSettle(db, { paymentId: pay.paymentId, channelTxId: "ok1" });
    expect(getStock(db, "sku_t4").onHand).toBe(2);
    expect(getStock(db, "sku_t4").preoccupied).toBe(0);
  });

  it("sweepTimeoutOrders closes expired pending orders only", () => {
    upsertSku(db, { id: "sku_t5", title: "T5", priceCents: 100, onHand: 2 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t5", qty: 1 }],
      ttlMs: 1,
    });
    createPayment(db, o.id);
    upsertSku(db, { id: "sku_t6", title: "T6", priceCents: 100, onHand: 2 });
    const o2 = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_t6", qty: 1 }],
      ttlMs: 60_000,
    });
    createPayment(db, o2.id);

    const swept = sweepTimeoutOrders(db, Date.now() + 50);
    expect(swept.some((s) => s.orderId === o.id && s.orderStatus === "closed")).toBe(true);
    expect(swept.some((s) => s.orderId === o2.id)).toBe(false);
    expect(getStock(db, "sku_t5").available).toBe(2);
    expect(getStock(db, "sku_t6").available).toBe(1);

    const again = sweepTimeoutOrders(db, Date.now() + 50);
    expect(again.some((s) => s.orderId === o.id)).toBe(false);
  });
});
