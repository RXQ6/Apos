import type { PermissionMode } from "../types.js";
import { listFeatures, activeFeature } from "../features.js";

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
  /** true → blocked in explore mode */
  writes: boolean;
}

interface ToolImpl extends ToolSpec {
  run: (argText: string) => Promise<ToolResult> | ToolResult;
}

export interface ToolRegistryOptions {
  repoRoot: string;
}

export function createToolRegistry(opts: ToolRegistryOptions) {
  const tools: ToolImpl[] = [
    {
      name: "echo",
      description: "Echo input (connectivity smoke test)",
      writes: false,
      run: (argText) => ({ ok: true, output: argText || "(empty)" }),
    },
    {
      name: "feature_list_read",
      description: "Read features/*/feature.json summaries",
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
      description: "Append a line to PROGRESS.md (write tool)",
      writes: true,
      run: async (argText) => {
        if (!argText.trim()) return { ok: false, error: "usage: /progress_update <note>" };
        const { appendFileSync } = await import("node:fs");
        const path = `${opts.repoRoot}/PROGRESS.md`;
        appendFileSync(path, `\n- [agent] ${argText.trim()}\n`, "utf8");
        return { ok: true, output: `appended to PROGRESS.md: ${argText.trim()}` };
      },
    },
  ];

  return {
    list: () => tools.map(({ name, description, writes }) => ({ name, description, writes })),
    has: (name: string) => tools.some((t) => t.name === name),
    async invoke(name: string, argText: string, ctx: ToolContext): Promise<ToolResult> {
      const tool = tools.find((t) => t.name === name);
      if (!tool) return { ok: false, error: `unknown tool ${name}` };
      if (tool.writes && ctx.mode === "explore") {
        return { ok: false, error: `explore mode blocks write tool ${name}` };
      }
      return tool.run(argText);
    },
  };
}
