import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ChatMessage, SessionMeta } from "./types.js";

export function ensureSessionDir(sessionsRoot: string, sessionId: string): string {
  const dir = join(sessionsRoot, sessionId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Dual-write helper: append one JSONL line for debug/git-friendly traces. */
export function appendSessionJsonl(
  sessionsRoot: string,
  sessionId: string,
  message: ChatMessage,
): void {
  const dir = ensureSessionDir(sessionsRoot, sessionId);
  appendFileSync(join(dir, "messages.jsonl"), `${JSON.stringify(message)}\n`, "utf8");
}

export function newSessionMeta(title: string, mode: SessionMeta["permissionMode"]): SessionMeta {
  const now = Date.now();
  return {
    id: `s_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    permissionMode: mode,
  };
}
