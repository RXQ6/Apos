import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureSummary } from "./types.js";

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Parse repo features/<id>/feature.json — document domain remains authoritative. */
export function listFeatures(repoRoot: string): FeatureSummary[] {
  const dir = join(repoRoot, "features");
  if (!existsSync(dir)) return [];
  const out: FeatureSummary[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const fp = join(dir, name.name, "feature.json");
    if (!existsSync(fp)) continue;
    try {
      const raw = readJson(fp);
      const harness = (raw.harness ?? {}) as Record<string, unknown>;
      const id = String(raw.id ?? name.name);
      out.push({
        id,
        title: String(raw.title ?? id),
        summary: String(raw.summary ?? ""),
        domain: String(raw.domain ?? ""),
        priority: String(raw.priority ?? ""),
        status: String(raw.status ?? ""),
        harnessStatus: (harness.status as FeatureSummary["harnessStatus"]) ?? "not_started",
        verify: String(harness.verify ?? "docs:verify"),
        path: `features/${name.name}`,
      });
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function activeFeature(features: FeatureSummary[]): FeatureSummary | undefined {
  return features.find((f) => f.harnessStatus === "active");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
