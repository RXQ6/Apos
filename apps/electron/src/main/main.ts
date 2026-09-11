import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AposAgentRunner,
  insertMessage,
  insertSession,
  listFeatures,
  listSessions,
  newSessionMeta,
  openAposDb,
  resolveAppPaths,
  type PermissionMode,
} from "@apos/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.APOS_REPO_ROOT ?? join(__dirname, "..", "..", "..", "..", "..");
const paths = resolveAppPaths(process.env.APOS_HOME);
const db = openAposDb(paths.dataDb);

let win: BrowserWindow | null = null;
let runner: AposAgentRunner | null = null;
let currentSessionId = "";
let mode: PermissionMode = "ask";

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Apos（景枢）",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function ensureRunner(sessionId: string) {
  runner = new AposAgentRunner(sessionId, {
    repoRoot,
    sessionsRoot: paths.sessionsDir,
    permissionMode: mode,
    db,
  });
  runner.on("event", (evt) => {
    win?.webContents.send("apos:agent-event", evt);
  });
  return runner;
}

ipcMain.handle("apos:init", async () => {
  const features = listFeatures(repoRoot);
  const sessions = listSessions(db);
  return {
    repoRoot,
    features,
    sessions,
    mode,
    tools: runner?.listTools() ?? [],
  };
});

ipcMain.handle("apos:set-mode", async (_e, m: PermissionMode) => {
  mode = m;
  runner?.setMode(m);
  return { mode };
});

ipcMain.handle("apos:new-session", async () => {
  const meta = newSessionMeta(`会话 ${new Date().toLocaleString("zh-CN")}`, mode);
  insertSession(db, { ...meta, permissionMode: mode });
  currentSessionId = meta.id;
  ensureRunner(meta.id);
  return meta;
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
  insertMessage(db, { sessionId: currentSessionId, role: "user", text, ts: Date.now() });
  await runner?.handleUserInput(text);
  return { ok: true };
});

ipcMain.handle("apos:list-features", async () => listFeatures(repoRoot));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
