import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openAposDb, getStock, type AposDb } from "@apos/shared";
import { createShopApp } from "../src/app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let dir: string;
let db: AposDb;
let app: ReturnType<typeof createShopApp>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "apos-shop-"));
  db = openAposDb(join(dir, "data.db"));
  app = createShopApp(db, { publicDir: join(__dirname, "..", "public") });
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

async function json(res: Response) {
  return res.json();
}

describe("shop http api", () => {
  it("health + seed + search", async () => {
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    const seed = await app.request("/api/admin/seed-demo", { method: "POST" });
    expect(seed.status).toBe(200);
    const search = await app.request("/api/catalog/search?q=红茶");
    const list = await json(search);
    expect(list.length).toBeGreaterThan(0);
  });

  it("full buy path: register → cart → order → sandbox pay", async () => {
    await app.request("/api/admin/seed-demo", { method: "POST" });
    const reg = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "b@apos.local", password: "secret1" }),
    });
    expect(reg.status).toBe(200);
    const auth = await json(reg);
    const headers = {
      Authorization: `Bearer ${auth.sessionToken}`,
      "Content-Type": "application/json",
    };

    const add = await app.request("/api/cart/items", {
      method: "POST",
      headers,
      body: JSON.stringify({ skuId: "sku_tea", qty: 2 }),
    });
    expect(add.status).toBe(200);

    const ready = await app.request("/api/cart/checkout-ready", {
      method: "POST",
      headers,
    });
    const readyBody = await json(ready);
    expect(readyBody.payAmountCents).toBe(9800);

    const orderRes = await app.request("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({ fromCart: true }),
    });
    expect(orderRes.status).toBe(201);
    const order = await json(orderRes);
    expect(order.status).toBe("pending_payment");

    const payRes = await app.request("/api/payments", {
      method: "POST",
      headers,
      body: JSON.stringify({ orderId: order.id }),
    });
    const pay = await json(payRes);
    const charge = await app.request(`/api/payments/${pay.paymentId}/charge`, {
      method: "POST",
      headers,
    });
    const chargeBody = await json(charge);
    expect(chargeBody.channelPayload.sandboxPayUrl).toContain("sandbox://pay/");

    const settle = await app.request(`/api/payments/${pay.paymentId}/sandbox-settle`, {
      method: "POST",
      headers,
      body: JSON.stringify({ outcome: "SUCCESS" }),
    });
    expect(settle.status).toBe(200);
    const settled = await json(settle);
    expect(settled.orderStatus).toBe("paid");

    const order2 = await app.request(`/api/orders/${order.id}`, { headers });
    expect((await json(order2)).status).toBe("paid");
    expect(getStock(db, "sku_tea").onHand).toBe(18);
  });

  it("rejects cart write without auth is not required for guest, but order needs login", async () => {
    await app.request("/api/admin/seed-demo", { method: "POST" });
    const guestAdd = await app.request("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Id": "g1" },
      body: JSON.stringify({ skuId: "sku_cup", qty: 1 }),
    });
    expect(guestAdd.status).toBe(200);

    const orderRes = await app.request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCart: true }),
    });
    expect(orderRes.status).toBe(401);
    const err = await json(orderRes);
    expect(err.code).toBe("AUTH_FAILED");
  });

  it("merges guest cart on login and clears cart after order", async () => {
    await app.request("/api/admin/seed-demo", { method: "POST" });
    await app.request("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Id": "g-merge" },
      body: JSON.stringify({ skuId: "sku_tea", qty: 1 }),
    });
    const reg = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Id": "g-merge" },
      body: JSON.stringify({ account: "m@apos.local", password: "secret1" }),
    });
    const auth = await json(reg);
    const headers = {
      Authorization: `Bearer ${auth.sessionToken}`,
      "Content-Type": "application/json",
    };
    const cart = await json(await app.request("/api/cart", { headers }));
    expect(cart.lines.some((l: { skuId: string }) => l.skuId === "sku_tea")).toBe(true);

    const order = await json(
      await app.request("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify({ fromCart: true }),
      }),
    );
    const cartAfter = await json(await app.request("/api/cart", { headers }));
    expect(cartAfter.lines.length).toBe(0);
    expect(order.payAmountCents).toBe(4900);
  });

  it("blocks reading another customer's order", async () => {
    await app.request("/api/admin/seed-demo", { method: "POST" });
    const a = await json(
      await app.request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: "a1@apos.local", password: "secret1" }),
      }),
    );
    const b = await json(
      await app.request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: "b1@apos.local", password: "secret1" }),
      }),
    );
    const orderA = await json(
      await app.request("/api/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a.sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: [{ skuId: "sku_tea", qty: 1 }] }),
      }),
    );
    const res = await app.request(`/api/orders/${orderA.id}`, {
      headers: { Authorization: `Bearer ${b.sessionToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("invalid signed callback rejected", async () => {
    await app.request("/api/admin/seed-demo", { method: "POST" });
    const reg = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "c@apos.local", password: "secret1" }),
    });
    const auth = await json(reg);
    const headers = {
      Authorization: `Bearer ${auth.sessionToken}`,
      "Content-Type": "application/json",
    };
    const order = await json(
      await app.request("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify({ items: [{ skuId: "sku_tray", qty: 1 }] }),
      }),
    );
    const pay = await json(
      await app.request("/api/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ orderId: order.id }),
      }),
    );
    const cb = await app.request("/api/payments/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          paymentId: pay.paymentId,
          channelTxId: "x1",
          amountCents: pay.amountCents,
          status: "SUCCESS",
          timestamp: 1,
        },
        signature: "00",
      }),
    });
    expect(cb.status).toBe(400);
    expect((await json(cb)).code).toBe("SIGN_INVALID");
  });

  it("serves storefront html", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("景枢小店");
  });
});
