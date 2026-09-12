import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import type { AposDb } from "@apos/shared";
import { createShopApp } from "./app.js";

export function startShopServer(
  db: AposDb,
  opts?: { port?: number; publicDir?: string },
): { port: number; close: () => void; server: ServerType } {
  const app = createShopApp(db, { publicDir: opts?.publicDir });
  const port = opts?.port ?? Number(process.env.PORT ?? 8787);
  const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
  const addr = server.address();
  const bound = typeof addr === "object" && addr ? addr.port : port;
  return {
    port: bound,
    server,
    close: () => {
      server.close();
    },
  };
}
