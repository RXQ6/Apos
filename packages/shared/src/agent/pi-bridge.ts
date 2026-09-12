/**
 * Pi Agent SDK bridge.
 * When a provider key is configured, uses @earendil-works/pi-agent-core Agent + pi-ai stream.
 * Without a key, falls back to local tool/echo loop (same event surface).
 */
import type { PermissionMode } from "../types.js";
import type { ProviderConfig } from "../types.js";
import type { AposDb } from "../db/sqlite.js";
import { createToolRegistry } from "../tools/index.js";
import { appendSessionJsonl } from "../session.js";
import type { ChatMessage } from "../types.js";
import { EventEmitter } from "node:events";

export type AgentEventPayload =
  | { type: "token"; payload: string }
  | { type: "message"; payload: ChatMessage }
  | { type: "tool_start"; payload: unknown }
  | { type: "tool_end"; payload: unknown }
  | { type: "error"; payload: string }
  | { type: "mode"; payload: { llm: boolean; provider?: string } };

export interface PiBridgeOptions {
  repoRoot: string;
  sessionsRoot: string;
  sessionId: string;
  db?: AposDb;
  permissionMode?: PermissionMode;
  providers?: ProviderConfig[];
}

function pickProvider(providers: ProviderConfig[] | undefined): ProviderConfig | undefined {
  if (!providers?.length) return undefined;
  return providers.find((p) => p.apiKey && p.apiKey !== "***") ?? undefined;
}

/**
 * Try to dynamically load pi-ai stream; if unavailable return null.
 */
async function tryLoadPiStream(): Promise<
  ((req: unknown, opts: unknown) => AsyncIterable<unknown>) | null
> {
  try {
    const piAi = (await import("@earendil-works/pi-ai")) as Record<string, unknown>;
    const streamFn =
      (piAi.stream as ((req: unknown, opts: unknown) => AsyncIterable<unknown>) | undefined) ??
      (piAi.streamSimple as
        | ((req: unknown, opts: unknown) => AsyncIterable<unknown>)
        | undefined);
    return streamFn ?? null;
  } catch {
    return null;
  }
}

export class AposPiBridge extends EventEmitter {
  private mode: PermissionMode;
  private readonly tools: ReturnType<typeof createToolRegistry>;
  private llmEnabled = false;

  constructor(private readonly opts: PiBridgeOptions) {
    super();
    this.mode = opts.permissionMode ?? "ask";
    this.tools = createToolRegistry({ repoRoot: opts.repoRoot, db: opts.db });
    const provider = pickProvider(opts.providers);
    this.llmEnabled = Boolean(provider?.apiKey);
    this.emitEvent({
      type: "mode",
      payload: { llm: this.llmEnabled, provider: provider?.id },
    });
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  listTools() {
    return this.tools.list();
  }

  private emitEvent(e: AgentEventPayload): void {
    this.emit("event", e);
  }

  private pushMsg(msg: ChatMessage): void {
    appendSessionJsonl(this.opts.sessionsRoot, this.opts.sessionId, msg);
    this.emitEvent({ type: "message", payload: msg });
  }

  private async streamText(full: string): Promise<void> {
    for (let i = 0; i < full.length; i += 28) {
      this.emitEvent({ type: "token", payload: full.slice(i, i + 28) });
      await new Promise((r) => setTimeout(r, 6));
    }
    this.pushMsg({ role: "assistant", text: full, ts: Date.now() });
  }

  /**
   * Unified input handler.
   * Slash tools always local; free text goes to Pi LLM when configured, else echo.
   */
  async handleUserInput(text: string): Promise<void> {
    const trimmed = text.trim();
    this.pushMsg({ role: "user", text: trimmed, ts: Date.now() });

    if (trimmed.startsWith("/tools")) {
      await this.streamText(
        `可用工具：${this.tools.list().map((t) => t.name).join(", ")}`,
      );
      return;
    }
    const toolMatch = trimmed.match(/^\/([a-z_]+)(?:\s+([\s\S]+))?$/i);
    if (toolMatch?.[1] && this.tools.has(toolMatch[1])) {
      await this.runTool(toolMatch[1], toolMatch[2] ?? "");
      return;
    }

    if (this.llmEnabled) {
      await this.runLlm(trimmed);
      return;
    }

    // Local intent router so the web workbench is useful without an API key.
    const intent = this.matchIntent(trimmed);
    if (intent) {
      await this.runTool(intent.name, intent.args);
      return;
    }

    await this.streamText(
      `（本地模式，未配置 LLM）已收到：${trimmed}\n\n` +
        `可直接说：\n` +
        `· 列出场景 / 查看 harness\n` +
        `· 搜索红茶\n` +
        `· 上架商品 标题=龙井 价格=5900 库存=10\n` +
        `· 创建订单 用户=cus_x sku=sku_tea 数量=1\n` +
        `· 沙箱支付 支付单=pay_xxx\n` +
        `· 跑验证\n` +
        `或使用斜杠工具：/feature_list_read /catalog_search …`,
    );
  }

  private matchIntent(text: string): { name: string; args: string } | null {
    const t = text.replace(/\s+/g, "");
    if (/^(列出)?场景|功能清单|harness|feature/i.test(text) || t.includes("列出场景")) {
      return { name: "feature_list_read", args: "" };
    }
    if (/验证|verify/i.test(text) && !/支付/.test(text)) {
      return { name: "verify_run", args: "" };
    }
    const search = text.match(/搜索\s*(.+)/) || text.match(/查找\s*(.+)/);
    if (search?.[1]) {
      return { name: "catalog_search", args: JSON.stringify({ q: search[1].trim() }) };
    }
    if (/上架|发布商品|新建商品/.test(text)) {
      const title = text.match(/标题[=:：]?\s*([^\s]+)/)?.[1] ?? text.match(/上架\s*([^\s]+)/)?.[1] ?? "新商品";
      const price = Number(text.match(/价格[=:：]?\s*(\d+)/)?.[1] ?? 1000);
      const stock = text.match(/库存[=:：]?\s*(\d+)/)?.[1];
      return {
        name: "catalog_publish",
        args: JSON.stringify({
          title,
          priceCents: price,
          onHand: stock ? Number(stock) : 5,
        }),
      };
    }
    const order = text.match(/创建订单|下单/);
    if (order) {
      const customer = text.match(/用户[=:：]\s*([^\s]+)/)?.[1] ?? "guest-web";
      const sku = text.match(/sku[=:：]\s*([^\s]+)/)?.[1] ?? "sku_tea";
      const qty = Number(text.match(/数量[=:：]?\s*(\d+)/)?.[1] ?? 1);
      return {
        name: "order_create",
        args: JSON.stringify({ customerId: customer, items: [{ skuId: sku, qty }] }),
      };
    }
    const pay = text.match(/沙箱支付|支付成功|完成支付/);
    if (pay) {
      const paymentId = text.match(/支付单[=:：]?\s*([^\s]+)/)?.[1] ?? text.match(/(pay_[a-z0-9_]+)/i)?.[1];
      if (paymentId) {
        return { name: "payment_sandbox_settle", args: JSON.stringify({ paymentId }) };
      }
    }
    if (/库存/.test(text)) {
      const sku = text.match(/sku[=:：]\s*([^\s]+)/)?.[1] ?? "sku_tea";
      return { name: "inventory_get", args: JSON.stringify({ skuId: sku }) };
    }
    if (/种子|演示商品/.test(text)) {
      return { name: "inventory_seed", args: JSON.stringify({ skuId: "sku_demo", title: "演示茶", priceCents: 990, onHand: 8 }) };
    }
    return null;
  }

  private async runTool(name: string, argText: string): Promise<void> {
    if (this.mode === "explore" && name !== "feature_list_read" && name !== "inventory_get" && name !== "echo") {
      await this.streamText(`Explore 模式禁止写类工具：${name}`);
      return;
    }
    this.emitEvent({ type: "tool_start", payload: { name, argText } });
    const result = await this.tools.invoke(name, argText, { mode: this.mode });
    this.emitEvent({ type: "tool_end", payload: { name, result } });
    await this.streamText(
      result.ok ? `工具 ${name} 成功：\n${result.output}` : `工具 ${name} 失败：${result.error}`,
    );
  }

  private async runLlm(prompt: string): Promise<void> {
    const provider = pickProvider(this.opts.providers);
    const streamFn = await tryLoadPiStream();
    if (!streamFn || !provider) {
      await this.streamText("LLM 配置不完整或 pi-ai 不可用，已回退 echo。");
      return;
    }
    try {
      const piAgent = await import("@earendil-works/pi-agent-core");
      const AgentCtor = (piAgent as { Agent?: new (o: unknown) => unknown }).Agent;
      if (!AgentCtor) {
        await this.streamText("pi-agent-core Agent 导出缺失，回退 echo。");
        return;
      }
      const toolNames = this.tools.list().map((t) => t.name);
      const agent = new AgentCtor({
        sessionId: this.opts.sessionId,
        getApiKey: () => provider.apiKey,
        streamFn: streamFn as never,
        initialState: {
          messages: [
            {
              role: "system" as const,
              content: `你是 Apos 场景规划助手。可用本地工具：${toolNames.join(", ")}。仓库根：${this.opts.repoRoot}`,
            },
          ],
        },
      }) as {
        subscribe: (cb: (e: unknown) => void) => () => void;
        state: { messages: unknown[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [k: string]: any;
      };

      agent.subscribe((event: unknown) => {
        const e = event as { type?: string; message?: { content?: unknown } };
        if (e?.type === "assistant" || e?.type === "message") {
          const content = JSON.stringify(e.message?.content ?? e);
          this.emitEvent({ type: "token", payload: content.slice(0, 200) });
        }
      });

      // Prefer Agent.prompt / run if present; otherwise stream raw pi-ai.
      if (typeof agent.prompt === "function") {
        await agent.prompt(prompt);
        const last = agent.state?.messages?.[agent.state.messages.length - 1] as
          | { role?: string; content?: unknown }
          | undefined;
        const text =
          typeof last?.content === "string"
            ? last.content
            : JSON.stringify(last?.content ?? "(no content)");
        this.pushMsg({ role: "assistant", text, ts: Date.now() });
        return;
      }

      // Fallback: raw stream
      const model = provider.model ?? "default";
      const iterable = streamFn(
        {
          model: `${provider.id}/${model}`,
          messages: [
            { role: "system", content: "你是 Apos 场景规划助手。" },
            { role: "user", content: prompt },
          ],
        },
        { apiKey: provider.apiKey, baseURL: provider.baseUrl },
      ) as AsyncIterable<Record<string, unknown>>;

      let full = "";
      for await (const part of iterable) {
        const delta =
          (part?.delta as string) ??
          (part?.text as string) ??
          (part?.content as string) ??
          "";
        if (delta) {
          full += delta;
          this.emitEvent({ type: "token", payload: delta });
        }
      }
      this.pushMsg({
        role: "assistant",
        text: full || JSON.stringify(iterable).slice(0, 200),
        ts: Date.now(),
      });
    } catch (err) {
      this.emitEvent({
        type: "error",
        payload: err instanceof Error ? err.message : String(err),
      });
      await this.streamText(
        `LLM 调用失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
