/**
 * Smoke: inventory preoccupy → order create → sandbox pay deduct → cancel path.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cancelOrder,
  createOrder,
  createPayment,
  DomainError,
  getStock,
  openAposDb,
  sandboxSettle,
  upsertSku,
} from "../dist/index.js";

const dir = mkdtempSync(join(tmpdir(), "apos-smoke-"));
const db = openAposDb(join(dir, "data.db"));

upsertSku(db, { id: "sku_apple", title: "苹果", priceCents: 500, onHand: 3 });
const stock0 = getStock(db, "sku_apple");
if (stock0.available !== 3) throw new Error("seed fail");

const order = createOrder(db, {
  customerId: "c1",
  items: [{ skuId: "sku_apple", qty: 2 }],
});
if (order.status !== "pending_payment" || order.payAmountCents !== 1000) {
  throw new Error(`bad order ${JSON.stringify(order)}`);
}
const stock1 = getStock(db, "sku_apple");
if (stock1.available !== 1 || stock1.preoccupied !== 2) {
  throw new Error(`preoccupy fail ${JSON.stringify(stock1)}`);
}

try {
  createOrder(db, {
    customerId: "c2",
    items: [{ skuId: "sku_apple", qty: 5 }],
  });
  throw new Error("should oversell fail");
} catch (e) {
  if (!(e instanceof DomainError) || e.code !== "STOCK_INSUFFICIENT") throw e;
}

const pay = createPayment(db, order.id);
const settled = sandboxSettle(db, { paymentId: pay.paymentId });
if (settled.orderStatus !== "paid") {
  throw new Error(`sandbox pay fail ${JSON.stringify(settled)}`);
}
const stock2 = getStock(db, "sku_apple");
if (stock2.onHand !== 1 || stock2.preoccupied !== 0) {
  throw new Error(`deduct fail ${JSON.stringify(stock2)}`);
}
sandboxSettle(db, { paymentId: pay.paymentId });

const order2 = createOrder(db, {
  customerId: "c1",
  items: [{ skuId: "sku_apple", qty: 1 }],
});
cancelOrder(db, order2.id, "user");
const stock3 = getStock(db, "sku_apple");
if (stock3.available !== 1 || stock3.preoccupied !== 0) {
  throw new Error(`release fail ${JSON.stringify(stock3)}`);
}

try {
  db.close();
} catch {
  /* ignore */
}
try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  /* Windows file lock */
}
console.log("SMOKE PASS: preoccupy/create/oversell/sandbox-pay/cancel");
