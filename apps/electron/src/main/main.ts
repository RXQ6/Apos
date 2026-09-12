import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AposAgentRunner,
  getProvidersJson,
  insertMessage,
  insertSession,
  listFeatures,
  listSessions,
  loadProviderConfig,
  newSessionMeta,
  openAposDb,
  resolveAppPaths,
  saveProviderConfig,
  setProvidersJson,
  type PermissionMode,
  type ProviderConfig,
} from "@apos/shared";
import { startShopServer } from "@apos/shop/start";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot =
  process.env.APOS_REPO_ROOT ?? join(__dirname, "..", "..", "..", "..", "..");
const paths = resolveAppPaths(process.env.APOS_HOME);
const db = openAposDb(paths.dataDb);

let win: BrowserWindow | null = null;
let shopWin: BrowserWindow | null = null;
let runner: AposAgentRunner | null = null;
let currentSessionId = "";
let mode: PermissionMode = "ask";
let shop: { port: number; close: () => void } | null = null;
let shopPort = Number(process.env.APOS_SHOP_PORT ?? 8787);

function loadProviders(): ProviderConfig[] {
  const raw = getProvidersJson(db);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProviderConfig[];
  } catch {
    return [];
  }
}

function log(...args: unknown[]): void {
  console.log("[apos]", ...args);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Apos（景枢）",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, "../renderer/index.html"));
}

function ensureRunner(sessionId: string) {
  runner = new AposAgentRunner(sessionId, {
    repoRoot,
    sessionsRoot: paths.sessionsDir,
    permissionMode: mode,
    db,
    providers: loadProviders(),
  });
  runner.on("event", (evt) => {
    win?.webContents.send("apos:agent-event", evt);
  });
  log("runner ready", sessionId);
}

ipcMain.handle("apos:init", async () => {
  const features = listFeatures(repoRoot);
  const sessions = listSessions(db);
  return {
    repoRoot,
    features,
    sessions,
    mode,
    providers: loadProviders().map((p) => ({
      id: p.id,
      label: p.label,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey ? "***" : undefined,
    })),
    tools: runner?.listTools() ?? [],
  };
});

ipcMain.handle("apos:set-mode", async (_e, m: PermissionMode) => {
  mode = m;
  runner?.setMode(m);
  return { mode };
});

ipcMain.handle("apos:save-providers", async (_e, configs: ProviderConfig[]) => {
  const list = configs ?? [];
  setProvidersJson(db, JSON.stringify(list));
  const secret =
    process.env.APOS_CREDENTIALS_SECRET ??
    String(getSettingSafe("credentials_secret") ?? "apos-local");
  try {
    saveProviderConfig(paths.credentialsPath, list, secret);
  } catch (err) {
    log("save credentials.enc failed", err);
  }
  if (runner) runner.setProviders(loadProviders());
  log("providers saved", list.map((p) => p.id).join(","));
  return { ok: true };
});

function getSettingSafe(key: string): string | undefined {
  try {
    const row = db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value;
  } catch {
    return undefined;
  }
}

ipcMain.handle("apos:new-session", async () => {
  const meta = newSessionMeta(`会话 ${new Date().toLocaleString("zh-CN")}`, mode);
  insertSession(db, { ...meta, permissionMode: mode });
  currentSessionId = meta.id;
  ensureRunner(meta.id);
  return meta;
});

ipcMain.handle("apos:resume-session", async (_e, sessionId: string) => {
  currentSessionId = sessionId;
  ensureRunner(sessionId);
  return { ok: true, sessionId };
});

ipcMain.handle("apos:send", async (_e, text: string) => {
  if (!runner) {
    if (!currentSessionId) {
      const meta = newSessionMeta(`会话 ${new Date().toLocaleString("zh-CN")}`, mode);
      insertSession(db, { ...meta, permissionMode: mode });
      currentSessionId = meta.id;
    }
    ensureRunner(currentSessionId);
  }
  insertMessage(db, {
    sessionId: currentSessionId,
    role: "user",
    text,
    ts: Date.now(),
  });
  await runner?.handleUserInput(text);
  return { ok: true };
});

ipcMain.handle("apos:list-features", async () => listFeatures(repoRoot));

function ensureShopServer() {
  if (shop) return shop;
  try {
    shop = startShopServer(db, { port: shopPort });
    shopPort = shop.port;
    log("shop server", `http://127.0.0.1:${shopPort}`);
    return shop;
  } catch (err) {
    log("shop server failed (maybe port busy)", err);
    return null;
  }
}

function openShopWindow() {
  const s = ensureShopServer();
  const url = `http://127.0.0.1:${s?.port ?? shopPort}/`;
  if (shopWin && !shopWin.isDestroyed()) {
    shopWin.focus();
    void shopWin.loadURL(url);
    return { ok: true, url };
  }
  shopWin = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "Apos 景枢小店",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void shopWin.loadURL(url);
  shopWin.on("closed", () => {
    shopWin = null;
  });
  return { ok: true, url };
}

ipcMain.handle("apos:open-shop", async () => openShopWindow());
ipcMain.handle("apos:shop-url", async () => {
  const s = ensureShopServer();
  return { url: `http://127.0.0.1:${s?.port ?? shopPort}/`, port: s?.port ?? shopPort };
});

app.whenReady().then(() => {
  log("app ready", { repoRoot, home: paths.root });
  ensureShopServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  try {
    shop?.close();
  } catch {
    /* ignore */
  }
  if (process.platform !== "darwin") app.quit();
});
