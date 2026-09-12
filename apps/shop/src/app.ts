import { Hono } from "hono";
import {
  attachSku,
  cancelOrder,
  cartAdd,
  cartCheckoutReady,
  cartClearChecked,
  cartMerge,
  cartUpdate,
  catalogDetail,
  catalogSearch,
  chargePayment,
  createOrder,
  createPayment,
  createSpu,
  DomainError,
  getOrder,
  getOrCreateCart,
  loginCustomer,
  publishSpu,
  receiveChannelCallback,
  registerCustomer,
  resolveCustomer,
  sandboxSettle,
  type AposDb,
} from "@apos/shared";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Env = {
  Variables: {
    db: AposDb;
    customerId?: string;
    guestId?: string;
  };
};

function jsonError(c: { json: (o: unknown, s: number) => Response }, err: unknown): Response {
  if (err instanceof DomainError) {
    const status =
      err.code === "AUTH_FAILED"
        ? 401
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "SIGN_INVALID"
            ? 400
            : err.code === "STOCK_INSUFFICIENT" ||
                err.code === "AMOUNT_MISMATCH" ||
                err.code === "ORDER_NOT_PAYABLE"
              ? 409
              : err.code === "UNKNOWN_PAYMENT" ||
                  err.code === "PAYMENT_NOT_FOUND" ||
                  err.code === "SPU_NOT_FOUND" ||
                  err.code === "ORDER_NOT_FOUND" ||
                  err.code === "CART_NOT_FOUND"
                ? 404
                : 400;
    return c.json({ code: err.code, message: err.message }, status as 400);
  }
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ code: "INTERNAL", message }, 500);
}

function bearer(c: {
  req: { header: (n: string) => string | undefined };
}): string | undefined {
  const h = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1];
}

function ownerFrom(c: {
  req: {
    header: (n: string) => string | undefined;
    query: (k: string) => string | undefined;
  };
  get: (k: "db") => AposDb;
  set: (k: "customerId" | "guestId", v: string) => void;
}): { ownerType: "user" | "guest"; ownerId: string; customerId?: string } {
  const token = bearer(c);
  if (token) {
    const resolved = resolveCustomer(c.get("db"), token);
    c.set("customerId", resolved.customerId);
    return { ownerType: "user", ownerId: resolved.customerId, customerId: resolved.customerId };
  }
  const guest =
    c.req.header("x-guest-id") ?? c.req.query("guestId") ?? "guest-demo";
  c.set("guestId", guest);
  return { ownerType: "guest", ownerId: guest };
}

function requireCustomer(c: {
  req: { header: (n: string) => string | undefined };
  get: (k: "db") => AposDb;
  set: (k: "customerId", v: string) => void;
}): string {
  const token = bearer(c);
  if (!token) throw new DomainError("AUTH_FAILED", "missing bearer token");
  const resolved = resolveCustomer(c.get("db"), token);
  c.set("customerId", resolved.customerId);
  return resolved.customerId;
}

function optionalCustomerId(c: {
  req: { header: (n: string) => string | undefined };
  get: (k: "db") => AposDb;
}): string | undefined {
  const token = bearer(c);
  if (!token) return undefined;
  return resolveCustomer(c.get("db"), token).customerId;
}

function requireOrderOwner(db: AposDb, orderId: string, customerId: string): void {
  const order = getOrder(db, orderId);
  if (order.customerId !== customerId) {
    throw new DomainError("FORBIDDEN", "order not owned by caller");
  }
}

export function createShopApp(db: AposDb, opts?: { publicDir?: string }): Hono<Env> {
  const app = new Hono<Env>();
  const publicDir = opts?.publicDir ?? join(__dirname, "..", "public");

  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.onError((err, c) => jsonError(c, err));

  app.get("/api/health", (c) => c.json({ ok: true, service: "apos-shop" }));

  app.post("/api/auth/register", async (c) => {
    try {
      const body = await c.req.json();
      const r = registerCustomer(db, {
        account: String(body.account ?? ""),
        password: String(body.password ?? ""),
      });
      const guestId = c.req.header("x-guest-id");
      if (guestId) {
        try {
          cartMerge(db, guestId, r.customerId);
        } catch {
          /* empty guest cart ok */
        }
      }
      return c.json(r);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/auth/login", async (c) => {
    try {
      const body = await c.req.json();
      const r = loginCustomer(db, {
        account: String(body.account ?? ""),
        password: String(body.password ?? ""),
      });
      const guestId = c.req.header("x-guest-id");
      if (guestId) {
        try {
          cartMerge(db, guestId, r.customerId);
        } catch {
          /* empty guest cart ok */
        }
      }
      return c.json(r);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/catalog/search", (c) => {
    try {
      const q = c.req.query("q");
      const page = c.req.query("page");
      const pageSize = c.req.query("pageSize");
      return c.json(
        catalogSearch(db, {
          q: q || undefined,
          page: page ? Number(page) : undefined,
          pageSize: pageSize ? Number(pageSize) : undefined,
        }),
      );
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/catalog/spus/:id", (c) => {
    try {
      return c.json(catalogDetail(db, c.req.param("id")));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/cart", (c) => {
    try {
      const owner = ownerFrom(c as never);
      const cart = getOrCreateCart(db, owner.ownerType, owner.ownerId);
      return c.json(cart);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/cart/items", async (c) => {
    try {
      const owner = ownerFrom(c as never);
      const cart = getOrCreateCart(db, owner.ownerType, owner.ownerId);
      const body = await c.req.json();
      const next = cartAdd(db, cart.id, String(body.skuId ?? ""), Number(body.qty ?? 1));
      return c.json(next);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.patch("/api/cart/items/:lineId", async (c) => {
    try {
      const owner = ownerFrom(c as never);
      const cart = getOrCreateCart(db, owner.ownerType, owner.ownerId);
      const body = await c.req.json();
      const next = cartUpdate(db, cart.id, c.req.param("lineId"), {
        qty: body.qty === undefined ? undefined : Number(body.qty),
        checked: body.checked === undefined ? undefined : Boolean(body.checked),
        remove: body.remove === undefined ? undefined : Boolean(body.remove),
      });
      return c.json(next);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.delete("/api/cart/items/:lineId", (c) => {
    try {
      const owner = ownerFrom(c as never);
      const cart = getOrCreateCart(db, owner.ownerType, owner.ownerId);
      const next = cartUpdate(db, cart.id, c.req.param("lineId"), { remove: true });
      return c.json(next);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/cart/checkout-ready", (c) => {
    try {
      const owner = ownerFrom(c as never);
      const cart = getOrCreateCart(db, owner.ownerType, owner.ownerId);
      return c.json(cartCheckoutReady(db, cart.id));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/orders", async (c) => {
    try {
      const customerId = requireCustomer(c as never);
      const body = await c.req.json();
      let items = (body.items as Array<{ skuId: string; qty: number }> | undefined) ?? [];
      let cartId: string | undefined;
      let skuIds: string[] = [];
      if (!items.length && body.fromCart) {
        const cart = getOrCreateCart(db, "user", customerId);
        const ready = cartCheckoutReady(db, cart.id);
        items = ready.items.map((i) => ({ skuId: i.skuId, qty: i.qty }));
        skuIds = items.map((i) => i.skuId);
        cartId = cart.id;
      }
      const order = createOrder(db, {
        customerId,
        items,
        address: body.address,
      });
      if (cartId && skuIds.length) cartClearChecked(db, cartId, skuIds);
      return c.json(order, 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/orders/:id", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      requireOrderOwner(db, c.req.param("id"), customerId);
      return c.json(getOrder(db, c.req.param("id")));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/orders/:id/cancel", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      requireOrderOwner(db, c.req.param("id"), customerId);
      return c.json(cancelOrder(db, c.req.param("id"), "user"));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/payments", async (c) => {
    try {
      const customerId = requireCustomer(c as never);
      const body = await c.req.json();
      const orderId = String(body.orderId ?? "");
      requireOrderOwner(db, orderId, customerId);
      const p = createPayment(
        db,
        orderId,
        body.channel ? String(body.channel) : "sandbox",
      );
      return c.json(p, 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  function ownPayment(c: { get: (k: "db") => AposDb; req: { header: (n: string) => string | undefined; param: (k: string) => string } }): string {
    const customerId = requireCustomer(c as never);
    const paymentId = c.req.param("id");
    const row = db
      .prepare(`SELECT order_id FROM payment WHERE id = ?`)
      .get(paymentId) as { order_id: string } | undefined;
    if (!row) throw new DomainError("UNKNOWN_PAYMENT", paymentId);
    requireOrderOwner(db, row.order_id, customerId);
    return paymentId;
  }

  app.post("/api/payments/:id/charge", (c) => {
    try {
      const paymentId = ownPayment(c as never);
      return c.json(chargePayment(db, paymentId));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/payments/callback", async (c) => {
    try {
      const body = await c.req.json();
      const raw = (body.payload ?? body) as Record<string, unknown>;
      const statusRaw = String(raw.status ?? "SUCCESS").toUpperCase();
      if (statusRaw !== "SUCCESS" && statusRaw !== "FAILED") {
        throw new DomainError("BAD_ARGS", "status must be SUCCESS|FAILED");
      }
      const payload = {
        channel: "sandbox" as const,
        paymentId: String(raw.paymentId ?? ""),
        channelTxId: String(raw.channelTxId ?? ""),
        amountCents: Number(raw.amountCents ?? 0),
        status: statusRaw as "SUCCESS" | "FAILED",
        timestamp: Number(raw.timestamp ?? Date.now()),
      };
      const r = receiveChannelCallback(db, {
        payload,
        signature: String(body.signature ?? ""),
      });
      return c.json(r);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/payments/:id/sandbox-settle", async (c) => {
    try {
      const paymentId = ownPayment(c as never);
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
      const outcome = body.outcome === "FAILED" ? ("FAILED" as const) : ("SUCCESS" as const);
      const r = sandboxSettle(db, {
        paymentId,
        outcome,
        channelTxId: body.channelTxId ? String(body.channelTxId) : undefined,
      });
      return c.json(r);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/admin/seed-demo", (c) => {
    try {
      const demos = [
        { title: "景枢红茶", priceCents: 4900, onHand: 20, skuId: "sku_tea" },
        { title: "青瓷杯", priceCents: 8900, onHand: 12, skuId: "sku_cup" },
        { title: "竹制茶盘", priceCents: 12900, onHand: 5, skuId: "sku_tray" },
      ];
      const created: Array<{ spuId: string; skuId: string; title: string }> = [];
      for (const d of demos) {
        const existing = db.prepare(`SELECT id FROM sku WHERE id = ?`).get(d.skuId) as
          | { id: string }
          | undefined;
        if (existing) {
          created.push({ spuId: "", skuId: d.skuId, title: d.title });
          continue;
        }
        const spuId = createSpu(db, { title: d.title });
        const skuId = attachSku(db, spuId, {
          id: d.skuId,
          title: d.title,
          priceCents: d.priceCents,
          onHand: d.onHand,
        });
        publishSpu(db, spuId);
        created.push({ spuId, skuId, title: d.title });
      }
      return c.json({ seeded: created });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  // static storefront
  app.get("/", (c) => {
    const htmlPath = join(publicDir, "index.html");
    if (!existsSync(htmlPath)) {
      return c.text("storefront missing", 404);
    }
    return c.html(readFileSync(htmlPath, "utf8"));
  });

  return app;
}
