import type { PermissionMode } from "../types.js";
import { listFeatures, activeFeature } from "../features.js";
import type { AposDb } from "../db/sqlite.js";
import {
  approveAftersale,
  attachSku,
  cancelOrder,
  cartAdd,
  cartCheckoutReady,
  cartUpdate,
  catalogSearch,
  chargePayment,
  createOrder,
  createPayment,
  createShipment,
  createSpu,
  DomainError,
  getStock,
  loginCustomer,
  markPaidAndDeduct,
  markReturnReceived,
  offShelfSpu,
  openAftersale,
  publishSpu,
  receiveChannelCallback,
  refundOnly,
  registerCustomer,
  returnRefund,
  sandboxSettle,
  paymentTimeoutClose,
  shipShipment,
  signShipment,
  sweepTimeoutOrders,
  upsertSku,
  getOrCreateCart,
} from "../domain/index.js";

export interface ToolResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface ToolContext {
  mode: PermissionMode;
}

export interface ToolSpec {
  name: string;
  description: string;
  writes: boolean;
}

interface ToolImpl extends ToolSpec {
  run: (argText: string) => Promise<ToolResult> | ToolResult;
}

export interface ToolRegistryOptions {
  repoRoot: string;
  /** When set, domain tools (order/inventory) are available. */
  db?: AposDb;
}

function parseJsonArgs(argText: string): Record<string, unknown> {
  const t = argText.trim();
  if (!t) return {};
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    throw new DomainError("BAD_ARGS", `expect JSON args, got: ${t.slice(0, 80)}`);
  }
}

export function createToolRegistry(opts: ToolRegistryOptions) {
  const db = opts.db;

  const tools: ToolImpl[] = [
    {
      name: "echo",
      description: "Echo input (connectivity smoke test)",
      writes: false,
      run: (argText) => ({ ok: true, output: argText || "(empty)" }),
    },
    {
      name: "feature_list_read",
      description: "Read features summaries",
      writes: false,
      run: () => {
        const features = listFeatures(opts.repoRoot);
        const active = activeFeature(features);
        const lines = features.map(
          (f) => `- ${f.id} [${f.harnessStatus}] ${f.title} (${f.priority})`,
        );
        return {
          ok: true,
          output: [
            `count=${features.length}`,
            `active=${active?.id ?? "(none)"}`,
            ...lines,
          ].join("\n"),
        };
      },
    },
    {
      name: "verify_run",
      description: "Run scripts/verify.ps1 (L1 structure check)",
      writes: false,
      run: async () => {
        const { spawnSync } = await import("node:child_process");
        const script = `${opts.repoRoot}/scripts/verify.ps1`;
        const r = spawnSync(
          "powershell",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
          { encoding: "utf8", cwd: opts.repoRoot },
        );
        const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
        if (r.status === 0) return { ok: true, output: out || "VERIFY PASS" };
        return { ok: false, error: out || `exit ${r.status}` };
      },
    },
    {
      name: "progress_update",
      description: "Append a line to PROGRESS.md",
      writes: true,
      run: async (argText) => {
        if (!argText.trim()) {
          return { ok: false, error: "usage: /progress_update <note>" };
        }
        const { appendFileSync } = await import("node:fs");
        appendFileSync(
          `${opts.repoRoot}/PROGRESS.md`,
          `\n- [agent] ${argText.trim()}\n`,
          "utf8",
        );
        return { ok: true, output: `appended: ${argText.trim()}` };
      },
    },
    {
      name: "inventory_seed",
      description: "Seed/upsert SKU inventory. JSON: {skuId,title,priceCents,onHand}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const skuId = String(a.skuId ?? a.id ?? "");
        if (!skuId) return { ok: false, error: "skuId required" };
        const sku = upsertSku(db, {
          id: skuId,
          title: String(a.title ?? skuId),
          priceCents: Number(a.priceCents ?? 0),
          onHand: a.onHand === undefined ? undefined : Number(a.onHand),
        });
        const stock = getStock(db, sku.id);
        return { ok: true, output: JSON.stringify({ sku, stock }, null, 2) };
      },
    },
    {
      name: "inventory_get",
      description: "Get stock. JSON: {skuId}",
      writes: false,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const stock = getStock(db, String(a.skuId ?? a.id ?? ""));
        return { ok: true, output: JSON.stringify(stock, null, 2) };
      },
    },
    {
      name: "order_create",
      description:
        'Create order. JSON: {customerId, items:[{skuId,qty}]} → quote+preoccupy+pending',
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const items = (a.items as Array<{ skuId: string; qty: number }> | undefined) ?? [];
        const order = createOrder(db, {
          customerId: String(a.customerId ?? "guest"),
          items,
          address: a.address,
        });
        return { ok: true, output: JSON.stringify(order, null, 2) };
      },
    },
    {
      name: "order_pay",
      description: "Mark paid + deduct stock. JSON: {orderId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const order = markPaidAndDeduct(db, String(a.orderId ?? ""));
        return { ok: true, output: JSON.stringify(order, null, 2) };
      },
    },
    {
      name: "order_cancel",
      description: "Cancel pending order + release stock. JSON: {orderId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const order = cancelOrder(db, String(a.orderId ?? ""), "user");
        return { ok: true, output: JSON.stringify(order, null, 2) };
      },
    },
    {
      name: "customer_register",
      description: "Register. JSON: {account,password}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const r = registerCustomer(db, {
          account: String(a.account ?? ""),
          password: String(a.password ?? ""),
        });
        return { ok: true, output: JSON.stringify(r) };
      },
    },
    {
      name: "customer_login",
      description: "Login. JSON: {account,password}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const r = loginCustomer(db, {
          account: String(a.account ?? ""),
          password: String(a.password ?? ""),
        });
        return { ok: true, output: JSON.stringify(r) };
      },
    },
    {
      name: "catalog_publish",
      description: "Create draft SPU+SKU and publish. JSON: {title,skuId,priceCents,onHand}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const spuId = createSpu(db, { title: String(a.title ?? "商品") });
        const skuId = attachSku(db, spuId, {
          id: a.skuId ? String(a.skuId) : undefined,
          title: String(a.skuTitle ?? a.title ?? "SKU"),
          priceCents: Number(a.priceCents ?? 0),
          onHand: a.onHand === undefined ? undefined : Number(a.onHand),
        });
        publishSpu(db, spuId);
        return { ok: true, output: JSON.stringify({ spuId, skuId }) };
      },
    },
    {
      name: "catalog_search",
      description: "Search on_shelf SPU. JSON: {q?,page?}",
      writes: false,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        return {
          ok: true,
          output: JSON.stringify(
            catalogSearch(db, {
              q: a.q ? String(a.q) : undefined,
              page: a.page === undefined ? undefined : Number(a.page),
            }),
            null,
            2,
          ),
        };
      },
    },
    {
      name: "catalog_off_shelf",
      description: "Off-shelf SPU. JSON: {spuId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        return { ok: true, output: offShelfSpu(db, String(a.spuId ?? "")) };
      },
    },
    {
      name: "cart_add",
      description: "Add to cart. JSON: {ownerId,skuId,qty,ownerType?}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const ownerType = (a.ownerType === "guest" ? "guest" : "user") as "user" | "guest";
        const cart = getOrCreateCart(db, ownerType, String(a.ownerId ?? "guest"));
        const next = cartAdd(db, cart.id, String(a.skuId ?? ""), Number(a.qty ?? 1));
        return { ok: true, output: JSON.stringify(next, null, 2) };
      },
    },
    {
      name: "cart_update",
      description: "Update cart line. JSON: {ownerId,lineId,qty?,checked?,remove?}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const cart = getOrCreateCart(db, "user", String(a.ownerId ?? "guest"));
        const next = cartUpdate(db, cart.id, String(a.lineId ?? ""), {
          qty: a.qty === undefined ? undefined : Number(a.qty),
          checked: a.checked === undefined ? undefined : Boolean(a.checked),
          remove: a.remove === undefined ? undefined : Boolean(a.remove),
        });
        return { ok: true, output: JSON.stringify(next, null, 2) };
      },
    },
    {
      name: "cart_checkout_ready",
      description: "Validate checked lines. JSON: {ownerId}",
      writes: false,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const cart = getOrCreateCart(db, "user", String(a.ownerId ?? "guest"));
        return {
          ok: true,
          output: JSON.stringify(cartCheckoutReady(db, cart.id), null, 2),
        };
      },
    },
    {
      name: "payment_create",
      description: "Create payment for order. JSON: {orderId,channel?}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const p = createPayment(db, String(a.orderId ?? ""), a.channel ? String(a.channel) : "sandbox");
        return { ok: true, output: JSON.stringify(p, null, 2) };
      },
    },
    {
      name: "payment_charge",
      description: "Charge payment. JSON: {paymentId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const r = chargePayment(db, String(a.paymentId ?? ""));
        return { ok: true, output: JSON.stringify(r, null, 2) };
      },
    },
    {
      name: "payment_sandbox_settle",
      description:
        'Sandbox channel settle (signed callback). JSON: {paymentId,outcome?:SUCCESS|FAILED,channelTxId?}',
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const outcome = a.outcome === "FAILED" ? ("FAILED" as const) : ("SUCCESS" as const);
        const r = sandboxSettle(db, {
          paymentId: String(a.paymentId ?? ""),
          outcome,
          channelTxId: a.channelTxId ? String(a.channelTxId) : undefined,
        });
        return { ok: true, output: JSON.stringify(r, null, 2) };
      },
    },
    {
      name: "payment_timeout_close",
      description: "Close one unpaid payment + timeout-cancel order. JSON: {paymentId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const r = paymentTimeoutClose(db, String(a.paymentId ?? ""));
        return { ok: true, output: JSON.stringify(r, null, 2) };
      },
    },
    {
      name: "order_timeout_sweep",
      description: "Sweep expired pending orders (close payments + release stock). JSON: {}",
      writes: true,
      run: () => {
        if (!db) return { ok: false, error: "db not attached" };
        const r = sweepTimeoutOrders(db);
        return { ok: true, output: JSON.stringify(r, null, 2) };
      },
    },
    {
      name: "payment_callback",
      description:
        "Signed channel callback. JSON: {payload:{paymentId,channelTxId,amountCents,status,timestamp},signature}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const raw = (a.payload ?? a) as Record<string, unknown>;
        const statusRaw = String(raw.status ?? "SUCCESS").toUpperCase();
        if (statusRaw !== "SUCCESS" && statusRaw !== "FAILED") {
          return { ok: false, error: "BAD_ARGS: status must be SUCCESS|FAILED" };
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
          signature: String(a.signature ?? ""),
        });
        return { ok: true, output: JSON.stringify(r, null, 2) };
      },
    },
    {
      name: "fulfillment_ship",
      description: "Create+ship. JSON: {orderId,carrier,trackingNo}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const sid = createShipment(db, { orderId: String(a.orderId ?? "") });
        const r = shipShipment(db, {
          shipmentId: sid,
          carrier: String(a.carrier ?? "SF"),
          trackingNo: String(a.trackingNo ?? `TN${Date.now()}`),
        });
        return { ok: true, output: JSON.stringify({ shipmentId: sid, ...r }) };
      },
    },
    {
      name: "fulfillment_sign",
      description: "Sign shipment. JSON: {shipmentId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        return {
          ok: true,
          output: JSON.stringify(signShipment(db, String(a.shipmentId ?? ""))),
        };
      },
    },
    {
      name: "aftersale_refund_only",
      description: "Open+approve+refund only. JSON: {orderId,amountCents?}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const open = openAftersale(db, {
          orderId: String(a.orderId ?? ""),
          type: "refund_only",
          reason: String(a.reason ?? "user"),
          amountCents: a.amountCents === undefined ? undefined : Number(a.amountCents),
        });
        approveAftersale(db, open.aftersaleId, "approved");
        const r = refundOnly(db, open.aftersaleId);
        return { ok: true, output: JSON.stringify({ aftersaleId: open.aftersaleId, ...r }) };
      },
    },
    {
      name: "aftersale_return_refund",
      description: "Return flow: open→approve→receive→refund. JSON: {orderId}",
      writes: true,
      run: (argText) => {
        if (!db) return { ok: false, error: "db not attached" };
        const a = parseJsonArgs(argText);
        const open = openAftersale(db, {
          orderId: String(a.orderId ?? ""),
          type: "return_refund",
          reason: String(a.reason ?? "return"),
        });
        approveAftersale(db, open.aftersaleId, "approved");
        markReturnReceived(db, open.aftersaleId);
        const r = returnRefund(db, open.aftersaleId);
        return { ok: true, output: JSON.stringify({ aftersaleId: open.aftersaleId, ...r }) };
      },
    },
  ];

  return {
    list: () =>
      tools.map(({ name, description, writes }) => ({ name, description, writes })),
    has: (name: string) => tools.some((t) => t.name === name),
    async invoke(name: string, argText: string, ctx: ToolContext): Promise<ToolResult> {
      const tool = tools.find((t) => t.name === name);
      if (!tool) return { ok: false, error: `unknown tool ${name}` };
      if (tool.writes && ctx.mode === "explore") {
        return { ok: false, error: `explore mode blocks write tool ${name}` };
      }
      try {
        return await tool.run(argText);
      } catch (err) {
        if (err instanceof DomainError) {
          return { ok: false, error: `${err.code}: ${err.message}` };
        }
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
