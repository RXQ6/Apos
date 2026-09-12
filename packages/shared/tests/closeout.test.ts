import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveAftersale,
  attachSku,
  cartAdd,
  cartMerge,
  cartUpdate,
  catalogDetail,
  catalogSearch,
  changeOrderAddress,
  chargePayment,
  createCouponTemplate,
  createOrder,
  createPayment,
  createShipment,
  createSpu,
  DomainError,
  getOrder,
  getOrCreateCart,
  getStock,
  listAddresses,
  listOrders,
  loginCustomer,
  logoutCustomer,
  markReturnReceived,
  offShelfSpu,
  openAftersale,
  openAposDb,
  publishSpu,
  quoteCheckout,
  quoteLines,
  receiveCoupon,
  refundOnly,
  registerCustomer,
  repayOrder,
  returnRefund,
  sandboxSettle,
  saveAddress,
  setSkuActivityPrice,
  shipShipment,
  signShipment,
  trackShipment,
  upsertSku,
  type AposDb,
} from "../src/index.js";

let dir: string;
let db: AposDb;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "apos-full-"));
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

describe("pricing.quote", () => {
  it("activity price beats member discount; coupon applies after", () => {
    upsertSku(db, { id: "sku_p", title: "P", priceCents: 1000, onHand: 5 });
    setSkuActivityPrice(db, "sku_p", 800);
    const q = quoteCheckout(db, {
      items: [{ skuId: "sku_p", qty: 1 }],
      memberLevel: "gold",
    });
    // activity 800, gold 10% => 80
    expect(q.payAmountCents).toBe(720);
    expect(q.activitySavedCents).toBe(200);
    expect(q.memberDiscountCents).toBe(80);

    createCouponTemplate(db, {
      code: "OFF100",
      title: "减100",
      discountCents: 100,
      totalStock: 10,
    });
    const reg = registerCustomer(db, { account: "p@x.com", password: "secret1" });
    const cp = receiveCoupon(db, { customerId: reg.customerId, code: "OFF100" });
    const q2 = quoteCheckout(db, {
      items: [{ skuId: "sku_p", qty: 1 }],
      memberLevel: "gold",
      couponInstanceId: cp.couponInstanceId,
    });
    expect(q2.payAmountCents).toBe(620);
  });

  it("createOrder uses quote snapshot and marks coupon used", () => {
    upsertSku(db, { id: "sku_q", title: "Q", priceCents: 500, onHand: 3 });
    createCouponTemplate(db, {
      code: "OFF50",
      title: "减50",
      discountCents: 50,
      totalStock: 5,
    });
    const reg = registerCustomer(db, { account: "q@x.com", password: "secret1" });
    const cp = receiveCoupon(db, { customerId: reg.customerId, code: "OFF50" });
    const o = createOrder(db, {
      customerId: reg.customerId,
      items: [{ skuId: "sku_q", qty: 1 }],
      couponInstanceId: cp.couponInstanceId,
    });
    expect(o.payAmountCents).toBe(450);
    expect(() =>
      receiveCoupon(db, { customerId: reg.customerId, code: "OFF50" }),
    ).toThrowError(DomainError);
  });

  it("quoteLines export works for order path", () => {
    upsertSku(db, { id: "sku_r", title: "R", priceCents: 100, onHand: 1 });
    const q = quoteLines(db, [{ skuId: "sku_r", qty: 2 }]);
    expect(q.payAmountCents).toBe(200);
  });
});

describe("cart + catalog + customer closeout", () => {
  it("cart update and merge", () => {
    upsertSku(db, { id: "sku_c1", title: "C1", priceCents: 100, onHand: 5 });
    const guest = getOrCreateCart(db, "guest", "g1");
    cartAdd(db, guest.id, "sku_c1", 1);
    const userCart = cartMerge(db, "g1", "u1");
    expect(userCart.lines.some((l) => l.skuId === "sku_c1")).toBe(true);
    const line = userCart.lines[0];
    const next = cartUpdate(db, userCart.id, line.id, { qty: 3 });
    expect(next.lines[0].qty).toBe(3);
    cartUpdate(db, userCart.id, line.id, { remove: true });
    expect(getOrCreateCart(db, "user", "u1").lines.length).toBe(0);
  });

  it("catalog detail and off shelf", () => {
    const spu = createSpu(db, { title: "茶" });
    const sku = attachSku(db, spu, { title: "茶", priceCents: 100, onHand: 2 });
    publishSpu(db, spu);
    const d = catalogDetail(db, spu);
    expect(d.skus[0].id).toBe(sku);
    offShelfSpu(db, spu);
    expect(catalogSearch(db, { q: "茶" }).length).toBe(0);
  });

  it("address save/list and logout", () => {
    const reg = registerCustomer(db, { account: "a@x.com", password: "secret1" });
    const addrId = saveAddress(db, reg.customerId, {
      receiver: "张三",
      phone: "13800000000",
      detail: "上海",
      isDefault: true,
    });
    expect(addrId).toBeTruthy();
    expect(listAddresses(db, reg.customerId).length).toBe(1);
    logoutCustomer(db, reg.sessionToken);
    expect(() => loginCustomer(db, { account: "a@x.com", password: "secret1" })).toBeTruthy();
  });
});

describe("order get/repay/address_change", () => {
  it("get list repay and address change", () => {
    upsertSku(db, { id: "sku_o", title: "O", priceCents: 100, onHand: 2 });
    const reg = registerCustomer(db, { account: "o@x.com", password: "secret1" });
    const o = createOrder(db, {
      customerId: reg.customerId,
      items: [{ skuId: "sku_o", qty: 1 }],
      address: { city: "BJ" },
    });
    expect(getOrder(db, o.id).status).toBe("pending_payment");
    expect(listOrders(db, reg.customerId).length).toBe(1);
    changeOrderAddress(db, o.id, { city: "SH" });
    const r = repayOrder(db, o.id);
    expect(r.status).toBe("paying");
    sandboxSettle(db, { paymentId: r.paymentId });
    expect(getOrder(db, o.id).status).toBe("paid");
    expect(() => repayOrder(db, o.id)).toThrowError(DomainError);
  });
});

describe("aftersale approve + fulfillment track/partial", () => {
  it("approve reject path", () => {
    upsertSku(db, { id: "sku_a", title: "A", priceCents: 100, onHand: 2 });
    const o = createOrder(db, {
      customerId: "c",
      items: [{ skuId: "sku_a", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    sandboxSettle(db, { paymentId: pay.paymentId });
    const open = openAftersale(db, {
      orderId: o.id,
      type: "refund_only",
      reason: "x",
    });
    const rejected = approveAftersale(db, open.aftersaleId, "rejected", "no");
    expect(rejected.status).toBe("rejected");
  });

  it("track shipment nodes and partial ship lines", () => {
    upsertSku(db, { id: "sku_f1", title: "F1", priceCents: 100, onHand: 5 });
    upsertSku(db, { id: "sku_f2", title: "F2", priceCents: 100, onHand: 5 });
    const o = createOrder(db, {
      customerId: "c",
      items: [
        { skuId: "sku_f1", qty: 1 },
        { skuId: "sku_f2", qty: 1 },
      ],
    });
    const pay = createPayment(db, o.id);
    sandboxSettle(db, { paymentId: pay.paymentId });
    const lineRows = db
      .prepare(`SELECT id, sku_id FROM order_line WHERE order_id = ?`)
      .all(o.id) as Array<{ id: string; sku_id: string }>;
    const l1 = lineRows.find((l) => l.sku_id === "sku_f1");
    const sid = createShipment(db, {
      orderId: o.id,
      lines: [{ orderLineId: l1!.id, qty: 1 }],
    });
    shipShipment(db, { shipmentId: sid, carrier: "SF", trackingNo: "T" });
    const track = trackShipment(db, sid);
    expect(track.nodes.some((n) => n.status === "shipped")).toBe(true);
    signShipment(db, sid);
    // second partial
    const l2 = lineRows.find((l) => l.sku_id === "sku_f2");
    const sid2 = createShipment(db, {
      orderId: o.id,
      lines: [{ orderLineId: l2!.id, qty: 1 }],
    });
    shipShipment(db, { shipmentId: sid2, carrier: "SF", trackingNo: "T2" });
    signShipment(db, sid2);
    expect(getOrder(db, o.id).status).toBe("completed");
  });

  it("coupon sold out and refund only still works after approve", () => {
    createCouponTemplate(db, {
      code: "LTD",
      title: "限量",
      discountCents: 10,
      totalStock: 1,
      perUserLimit: 1,
    });
    const a = registerCustomer(db, { account: "c1@x.com", password: "secret1" });
    const b = registerCustomer(db, { account: "c2@x.com", password: "secret1" });
    receiveCoupon(db, { customerId: a.customerId, code: "LTD" });
    expect(() => receiveCoupon(db, { customerId: b.customerId, code: "LTD" })).toThrowError(
      expect.objectContaining({ code: "COUPON_SOLD_OUT" }),
    );

    upsertSku(db, { id: "sku_rf", title: "RF", priceCents: 100, onHand: 1 });
    const o = createOrder(db, {
      customerId: a.customerId,
      items: [{ skuId: "sku_rf", qty: 1 }],
    });
    const pay = createPayment(db, o.id);
    chargePayment(db, pay.paymentId);
    sandboxSettle(db, { paymentId: pay.paymentId });
    const open = openAftersale(db, { orderId: o.id, type: "refund_only", reason: "d" });
    approveAftersale(db, open.aftersaleId, "approved");
    const rf = refundOnly(db, open.aftersaleId);
    expect(rf.status).toBe("success");
    expect(getStock(db, "sku_rf").onHand).toBe(0);
  });
});
