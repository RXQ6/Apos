import { homedir } from "node:os";
import { join } from "node:path";
import type { AppPaths } from "./types.js";

export function resolveAppPaths(overrideRoot?: string): AppPaths {
  const root = overrideRoot ?? join(homedir(), ".apos");
  return {
    root,
    dataDb: join(root, "data.db"),
    sessionsDir: join(root, "sessions"),
    credentialsPath: join(root, "credentials.enc"),
  };
}
