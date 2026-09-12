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
  changeOrderAddress,
  chargePayment,
  createCouponTemplate,
  createOrder,
  createPayment,
  createSpu,
  createShipment,
  DomainError,
  getCustomer,
  getOrder,
  getOrCreateCart,
  listAddresses,
  listPaymentChannels,
  chargeViaChannel,
  settleViaChannel,
  listOrders,
  loginCustomer,
  logoutCustomer,
  offShelfSpu,
  paymentTimeoutClose,
  publishSpu,
  quoteCheckout,
  receiveChannelCallback,
  receiveCoupon,
  registerCustomer,
  repayOrder,
  resolveCustomer,
  sandboxSettle,
  saveAddress,
  setSkuActivityPrice,
  shipShipment,
  signShipment,
  sweepTimeoutOrders,
  trackShipment,
  AposAgentRunner,
  listFeatures,
  getProvidersJson,
  setProvidersJson,
  saveProviderConfig,
  insertSession,
  listSessions,
  newSessionMeta,
  resolveAppPaths,
  type AposDb,
  type PermissionMode,
  type ProviderConfig,
} from "@apos/shared";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEMO_IMAGE: Record<string, string> = {
  sku_tea: "/images/sku_tea.png",
  sku_cup: "/images/sku_cup.png",
  sku_tray: "/images/sku_tray.png",
};

function withImage(row: {
  skuId?: string;
  spuId?: string;
  id?: string;
  title?: string;
} & Record<string, unknown>) {
  const key = String(row.skuId ?? row.id ?? "");
  return { ...row, image: DEMO_IMAGE[key] ?? null };
}

function resolvePublicDir(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.APOS_SHOP_PUBLIC,
    join(__dirname, "..", "public"),
    join(__dirname, "public"),
    // monorepo / electron esbuild bundle locations
    join(__dirname, "..", "..", "..", "shop", "public"),
    join(__dirname, "..", "..", "..", "..", "shop", "public"),
    join(__dirname, "..", "..", "..", "..", "..", "apps", "shop", "public"),
    join(process.cwd(), "apps", "shop", "public"),
    join(process.cwd(), "public"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return explicit ?? join(__dirname, "..", "public");
}

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

export function createShopApp(
  db: AposDb,
  opts?: { publicDir?: string; repoRoot?: string; sessionsRoot?: string },
): Hono<Env> {
  const app = new Hono<Env>();
  const publicDir = resolvePublicDir(opts?.publicDir);
  const repoRoot = opts?.repoRoot ?? process.env.APOS_REPO_ROOT ?? process.cwd();
  const sessionsRoot =
    opts?.sessionsRoot ?? resolveAppPaths(process.env.APOS_HOME).sessionsDir;

  let agentMode: PermissionMode = "ask";
  let agentSessionId = "";
  let runner: AposAgentRunner | null = null;

  function loadProviders(): ProviderConfig[] {
    const raw = getProvidersJson(db);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ProviderConfig[];
    } catch {
      return [];
    }
  }

  function ensureRunner(sessionId: string) {
    if (runner && runner.sessionId === sessionId) return runner;
    runner = new AposAgentRunner(sessionId, {
      repoRoot,
      sessionsRoot,
      permissionMode: agentMode,
      db,
      providers: loadProviders(),
    });
    return runner;
  }

  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.onError((err, c) => jsonError(c, err));

  app.get("/api/health", (c) => c.json({ ok: true, service: "apos-shop" }));

  // —— Agent workbench (web) ——
  app.get("/api/agent/bootstrap", (c) => {
    try {
      const features = listFeatures(repoRoot);
      const sessions = listSessions(db);
      const providers = loadProviders().map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.baseUrl,
        model: p.model,
        apiKey: p.apiKey ? "***" : undefined,
      }));
      if (!agentSessionId && sessions[0]) {
        agentSessionId = sessions[0].id;
      }
      if (agentSessionId) ensureRunner(agentSessionId);
      return c.json({
        repoRoot,
        features,
        sessions,
        mode: agentMode,
        providers,
        sessionId: agentSessionId,
        tools: runner?.listTools() ?? [],
      });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/agent/session", async (c) => {
    try {
      const meta = newSessionMeta(
        `会话 ${new Date().toLocaleString("zh-CN")}`,
        agentMode,
      );
      insertSession(db, { ...meta, permissionMode: agentMode });
      agentSessionId = meta.id;
      ensureRunner(meta.id);
      return c.json(meta, 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/agent/session/:id", (c) => {
    try {
      agentSessionId = c.req.param("id");
      ensureRunner(agentSessionId);
      return c.json({ ok: true, sessionId: agentSessionId });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/agent/mode", async (c) => {
    try {
      const body = await c.req.json();
      const m = String(body.mode ?? "ask") as PermissionMode;
      if (!["explore", "ask", "allow-all"].includes(m)) {
        throw new DomainError("BAD_ARGS", "mode");
      }
      agentMode = m;
      runner?.setMode(m);
      return c.json({ mode: agentMode });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/agent/providers", async (c) => {
    try {
      const body = await c.req.json();
      const list = (body.providers as ProviderConfig[] | undefined) ?? [];
      setProvidersJson(db, JSON.stringify(list));
      const secret =
        process.env.APOS_CREDENTIALS_SECRET ??
        (() => {
          try {
            return (
              (db
                .prepare(`SELECT value FROM app_settings WHERE key = ?`)
                .get("credentials_secret") as { value: string } | undefined
              )?.value ?? "apos-local"
            );
          } catch {
            return "apos-local";
          }
        })();
      try {
        saveProviderConfig(
          join(resolveAppPaths(process.env.APOS_HOME).root, "credentials.enc"),
          list,
          secret,
        );
      } catch {
        /* optional */
      }
      runner?.setProviders(loadProviders());
      return c.json({ ok: true });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/agent/send", async (c) => {
    try {
      const body = await c.req.json();
      const text = String(body.text ?? "");
      if (!text.trim()) throw new DomainError("BAD_ARGS", "text required");
      if (!agentSessionId) {
        const meta = newSessionMeta(
          `会话 ${new Date().toLocaleString("zh-CN")}`,
          agentMode,
        );
        insertSession(db, { ...meta, permissionMode: agentMode });
        agentSessionId = meta.id;
      }
      const r = ensureRunner(agentSessionId);
      const events: unknown[] = [];
      const onEvt = (e: unknown) => events.push(e);
      r.on("event", onEvt);
      try {
        await r.handleUserInput(text);
      } finally {
        r.off("event", onEvt);
      }
      return c.json({ sessionId: agentSessionId, events });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/workbench", (c) => {
    const htmlPath = join(publicDir, "workbench.html");
    if (!existsSync(htmlPath)) return c.text("workbench missing", 404);
    return c.html(readFileSync(htmlPath, "utf8"));
  });

  app.get("/api/payments/channels", (c) => {
    try {
      return c.json(listPaymentChannels(db));
    } catch (e) {
      return jsonError(c, e);
    }
  });

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
      const list = catalogSearch(db, {
        q: q || undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      const withImg = list.map((p) => {
        const sku = db
          .prepare(
            `SELECT id FROM sku WHERE spu_id = ? AND status = 'on_shelf' LIMIT 1`,
          )
          .get(p.spuId) as { id: string } | undefined;
        return {
          ...p,
          image: sku ? DEMO_IMAGE[sku.id] ?? null : null,
          skuId: sku?.id ?? null,
        };
      });
      return c.json(withImg);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/catalog/spus/:id", (c) => {
    try {
      const d = catalogDetail(db, c.req.param("id"));
      return c.json({
        ...d,
        image: d.skus?.[0] ? DEMO_IMAGE[d.skus[0].id] ?? null : null,
      });
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
      let memberLevel: string | undefined;
      try {
        memberLevel = resolveCustomer(db, bearer(c) ?? "").memberLevel;
      } catch {
        memberLevel = undefined;
      }
      const order = createOrder(db, {
        customerId,
        items,
        address: body.address,
        memberLevel,
        couponInstanceId: body.couponInstanceId
          ? String(body.couponInstanceId)
          : undefined,
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

  app.post("/api/payments/:id/charge", async (c) => {
    try {
      const paymentId = ownPayment(c as never);
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
      const channel = (body.channel ? String(body.channel) : undefined) as
        | "sandbox"
        | "alipay"
        | "wechat"
        | undefined;
      return c.json(chargeViaChannel(db, { paymentId, channel }));
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

  app.post("/api/payments/:id/timeout-close", (c) => {
    try {
      const paymentId = ownPayment(c as never);
      return c.json(paymentTimeoutClose(db, paymentId));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/admin/sweep-timeouts", (c) => {
    try {
      return c.json({ swept: sweepTimeoutOrders(db) });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/auth/logout", (c) => {
    try {
      const token = bearer(c);
      if (!token) throw new DomainError("AUTH_FAILED", "missing token");
      logoutCustomer(db, token);
      return c.json({ ok: true });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/me", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      return c.json(getCustomer(db, customerId));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/me/addresses", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      return c.json(listAddresses(db, customerId));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/me/addresses", async (c) => {
    try {
      const customerId = requireCustomer(c as never);
      const body = await c.req.json();
      const id = saveAddress(db, customerId, {
        receiver: String(body.receiver ?? ""),
        phone: String(body.phone ?? ""),
        detail: String(body.detail ?? ""),
        isDefault: Boolean(body.isDefault),
      });
      return c.json({ id }, 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/orders", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      return c.json(listOrders(db, customerId));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/orders/:id/address", async (c) => {
    try {
      const customerId = requireCustomer(c as never);
      requireOrderOwner(db, c.req.param("id"), customerId);
      const body = await c.req.json();
      return c.json(changeOrderAddress(db, c.req.param("id"), body.address ?? body));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/orders/:id/repay", (c) => {
    try {
      const customerId = requireCustomer(c as never);
      requireOrderOwner(db, c.req.param("id"), customerId);
      return c.json(repayOrder(db, c.req.param("id")));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/pricing/quote", async (c) => {
    try {
      const body = await c.req.json();
      let memberLevel = "base";
      const token = bearer(c);
      if (token) memberLevel = resolveCustomer(db, token).memberLevel;
      const items =
        (body.items as Array<{ skuId: string; qty: number }> | undefined) ?? [];
      return c.json(
        quoteCheckout(db, {
          items,
          memberLevel,
          couponInstanceId: body.couponInstanceId
            ? String(body.couponInstanceId)
            : undefined,
        }),
      );
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/pricing/coupons", async (c) => {
    try {
      const body = await c.req.json();
      return c.json(
        createCouponTemplate(db, {
          code: String(body.code ?? ""),
          title: String(body.title ?? body.code ?? ""),
          discountCents: Number(body.discountCents ?? 0),
          minAmountCents: body.minAmountCents
            ? Number(body.minAmountCents)
            : undefined,
          totalStock: body.totalStock ? Number(body.totalStock) : undefined,
          perUserLimit: body.perUserLimit ? Number(body.perUserLimit) : undefined,
        }),
        201,
      );
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/me/coupons/receive", async (c) => {
    try {
      const customerId = requireCustomer(c as never);
      const body = await c.req.json();
      return c.json(
        receiveCoupon(db, {
          customerId,
          code: body.code ? String(body.code) : undefined,
          templateId: body.templateId ? String(body.templateId) : undefined,
        }),
        201,
      );
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/admin/sku-activity", async (c) => {
    try {
      const body = await c.req.json();
      setSkuActivityPrice(db, String(body.skuId ?? ""), Number(body.priceCents ?? 0));
      return c.json({ ok: true, skuId: body.skuId, priceCents: body.priceCents });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/admin/spus/:id/off-shelf", (c) => {
    try {
      return c.json({ status: offShelfSpu(db, c.req.param("id")) });
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.get("/api/fulfillments/:shipmentId", (c) => {
    try {
      return c.json(trackShipment(db, c.req.param("shipmentId")));
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/internal/fulfillments", async (c) => {
    try {
      const body = await c.req.json();
      const shipmentId = createShipment(db, {
        orderId: String(body.orderId ?? ""),
        lines: body.lines as Array<{ orderLineId: string; qty: number }> | undefined,
      });
      return c.json({ shipmentId }, 201);
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/internal/fulfillments/:id/ship", async (c) => {
    try {
      const body = await c.req.json();
      return c.json(
        shipShipment(db, {
          shipmentId: c.req.param("id"),
          carrier: String(body.carrier ?? "SF"),
          trackingNo: String(body.trackingNo ?? ""),
        }),
      );
    } catch (e) {
      return jsonError(c, e);
    }
  });

  app.post("/api/internal/fulfillments/:id/sign", (c) => {
    try {
      return c.json(signShipment(db, c.req.param("id")));
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

  // static assets from public/
  app.get("/images/*", (c) => {
    const rel = c.req.path.replace(/^\/+/, "");
    const safe = rel.replace(/\.\./g, "");
    const filePath = join(publicDir, safe);
    if (!existsSync(filePath)) return c.text("not found", 404);
    const ext = filePath.split(".").pop()?.toLowerCase();
    const type =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : ext === "css"
                ? "text/css"
                : ext === "js"
                  ? "application/javascript"
                  : "application/octet-stream";
    return c.body(readFileSync(filePath), 200, { "Content-Type": type });
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
