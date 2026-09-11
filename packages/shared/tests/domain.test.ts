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
  paymentCallbackSuccess,
  publishSpu,
  refundOnly,
  registerCustomer,
  returnRefund,
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
    const cb = paymentCallbackSuccess(db, {
      paymentId: pay.paymentId,
      channelTxId: "tx1",
    });
    expect(cb.orderStatus).toBe("paid");
    // idempotent
    const cb2 = paymentCallbackSuccess(db, {
      paymentId: pay.paymentId,
      channelTxId: "tx1",
    });
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
    paymentCallbackSuccess(db, { paymentId: pay2.paymentId, channelTxId: "tx2" });
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
