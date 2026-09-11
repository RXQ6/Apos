import { EventEmitter } from "node:events";
import type { ChatMessage, PermissionMode } from "../types.js";
import { appendSessionJsonl } from "../session.js";
import { createToolRegistry, type ToolResult, type ToolSpec } from "../tools/index.js";
import type { AposDb } from "../db/sqlite.js";

export interface RunnerOptions {
  repoRoot: string;
  sessionsRoot: string;
  permissionMode?: PermissionMode;
  db?: AposDb;
  /** When true, tools that write files are blocked unless mode is allow-all. */
  requireAskForWrites?: boolean;
}

export interface AgentEvent {
  type: "token" | "message" | "tool_start" | "tool_end" | "error";
  payload: unknown;
}

/**
 * Thin agent runner. Phase ③ uses an echo loop; Phase later swaps in Pi Agent SDK
 * while keeping the same event surface for the renderer.
 */
export class AposAgentRunner extends EventEmitter {
  readonly sessionId: string;
  private mode: PermissionMode;
  private readonly tools: ReturnType<typeof createToolRegistry>;
  private readonly sessionsRoot: string;

  constructor(
    sessionId: string,
    private readonly opts: RunnerOptions,
  ) {
    super();
    this.sessionId = sessionId;
    this.mode = opts.permissionMode ?? "ask";
    this.sessionsRoot = opts.sessionsRoot;
    this.tools = createToolRegistry({ repoRoot: opts.repoRoot, db: opts.db });
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  listTools(): ToolSpec[] {
    return this.tools.list();
  }

  private emitMsg(msg: ChatMessage): void {
    appendSessionJsonl(this.sessionsRoot, this.sessionId, msg);
    this.emit("event", { type: "message", payload: msg } satisfies AgentEvent);
  }

  /** Echo + tool-routing loop (no LLM yet). */
  async handleUserInput(text: string): Promise<void> {
    const user: ChatMessage = { role: "user", text, ts: Date.now() };
    this.emitMsg(user);

    const trimmed = text.trim();
    if (trimmed.startsWith("/tools")) {
      const names = this.tools.list().map((t) => t.name).join(", ");
      await this.streamAssistant(`可用工具：${names}`);
      return;
    }

    const toolMatch = trimmed.match(/^\/([a-z_]+)(?:\s+([\s\S]+))?$/i);
    if (toolMatch?.[1] && this.tools.has(toolMatch[1])) {
      await this.runTool(toolMatch[1], toolMatch[2] ?? "");
      return;
    }

    await this.streamAssistant(
      `（echo）已收到：${trimmed}\n输入 /tools 查看工具，或 /feature_list_read /verify_run`,
    );
  }

  private async runTool(name: string, argText: string): Promise<void> {
    if (this.mode === "explore" && name !== "feature_list_read" && name !== "echo") {
      await this.streamAssistant(`Explore 模式禁止写类工具：${name}`);
      return;
    }
    this.emit("event", { type: "tool_start", payload: { name, argText } } satisfies AgentEvent);
    let result: ToolResult;
    try {
      result = await this.tools.invoke(name, argText, { mode: this.mode });
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    this.emit("event", { type: "tool_end", payload: { name, result } } satisfies AgentEvent);
    const text = result.ok
      ? `工具 ${name} 成功：\n${result.output}`
      : `工具 ${name} 失败：${result.error}`;
    await this.streamAssistant(text);
  }

  private async streamAssistant(full: string): Promise<void> {
    // Stream in small chunks so the UI path matches future Pi token streaming.
    const chunkSize = 24;
    for (let i = 0; i < full.length; i += chunkSize) {
      const token = full.slice(i, i + chunkSize);
      this.emit("event", { type: "token", payload: token } satisfies AgentEvent);
      await new Promise((r) => setTimeout(r, 8));
    }
    this.emitMsg({ role: "assistant", text: full, ts: Date.now() });
  }
}
