import type { PermissionMode } from "../types.js";
import { listFeatures, activeFeature } from "../features.js";
import type { AposDb } from "../db/sqlite.js";
import {
  cancelOrder,
  createOrder,
  DomainError,
  getStock,
  markPaidAndDeduct,
  upsertSku,
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
