import { EventEmitter } from "node:events";
import type { PermissionMode, ProviderConfig, ChatMessage } from "../types.js";
import type { AposDb } from "../db/sqlite.js";
import { AposPiBridge, type AgentEventPayload } from "./pi-bridge.js";

export interface RunnerOptions {
  repoRoot: string;
  sessionsRoot: string;
  permissionMode?: PermissionMode;
  db?: AposDb;
  providers?: ProviderConfig[];
  requireAskForWrites?: boolean;
}

export type AgentEvent = AgentEventPayload;

/** Thin facade over AposPiBridge for Electron main. */
export class AposAgentRunner extends EventEmitter {
  readonly sessionId: string;
  private readonly bridge: AposPiBridge;

  constructor(
    sessionId: string,
    private readonly opts: RunnerOptions,
  ) {
    super();
    this.sessionId = sessionId;
    this.bridge = new AposPiBridge({
      repoRoot: opts.repoRoot,
      sessionsRoot: opts.sessionsRoot,
      sessionId,
      db: opts.db,
      permissionMode: opts.permissionMode,
      providers: opts.providers,
    });
    this.bridge.on("event", (e: AgentEventPayload) => this.emit("event", e));
  }

  setMode(mode: PermissionMode): void {
    this.bridge.setMode(mode);
  }

  setProviders(providers: ProviderConfig[]): void {
    // recreate not required for tool path; LLM pick happens per-call via options snapshot
    (this.opts as { providers?: ProviderConfig[] }).providers = providers;
  }

  listTools() {
    return this.bridge.listTools();
  }

  async handleUserInput(text: string): Promise<void> {
    await this.bridge.handleUserInput(text);
  }

  /** Re-export type for UI message shape. */
  static isChatMessage(x: unknown): x is ChatMessage {
    const m = x as ChatMessage | null;
    return Boolean(m && typeof m.text === "string" && typeof m.role === "string");
  }
}
