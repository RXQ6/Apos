import { serve } from "@hono/node-server";
import { openAposDb, resolveAppPaths } from "@apos/shared";
import { createShopApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const paths = resolveAppPaths(process.env.APOS_HOME);
const db = openAposDb(process.env.APOS_SHOP_DB ?? paths.dataDb);
const app = createShopApp(db);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[apos-shop] http://127.0.0.1:${info.port}`);
  console.log(`[apos-shop] db=${process.env.APOS_SHOP_DB ?? paths.dataDb}`);
});
