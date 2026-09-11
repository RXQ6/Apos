/** Permission modes aligned with harness / Craft-style controls. */
export type PermissionMode = "explore" | "ask" | "allow-all";

export interface FeatureSummary {
  id: string;
  title: string;
  summary: string;
  domain: string;
  priority: string;
  status: string;
  harnessStatus: "not_started" | "active" | "blocked" | "passing";
  verify: string;
  path: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  text: string;
  ts: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  permissionMode: PermissionMode;
}

export interface ProviderConfig {
  id: string;
  label: string;
  baseUrl?: string;
  model?: string;
  /** Never log this; stored encrypted at rest. */
  apiKey?: string;
}

export interface AppPaths {
  root: string;
  dataDb: string;
  sessionsDir: string;
  credentialsPath: string;
}
