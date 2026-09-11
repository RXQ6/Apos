import { contextBridge, ipcRenderer } from "electron";

export interface AposApi {
  init: () => Promise<unknown>;
  setMode: (mode: "explore" | "ask" | "allow-all") => Promise<unknown>;
  saveProviders: (configs: unknown[]) => Promise<unknown>;
  newSession: () => Promise<unknown>;
  resumeSession: (id: string) => Promise<unknown>;
  send: (text: string) => Promise<unknown>;
  listFeatures: () => Promise<unknown>;
  onAgentEvent: (cb: (evt: unknown) => void) => () => void;
}

const api: AposApi = {
  init: () => ipcRenderer.invoke("apos:init"),
  setMode: (mode) => ipcRenderer.invoke("apos:set-mode", mode),
  saveProviders: (configs) => ipcRenderer.invoke("apos:save-providers", configs),
  newSession: () => ipcRenderer.invoke("apos:new-session"),
  resumeSession: (id) => ipcRenderer.invoke("apos:resume-session", id),
  send: (text) => ipcRenderer.invoke("apos:send", text),
  listFeatures: () => ipcRenderer.invoke("apos:list-features"),
  onAgentEvent: (cb) => {
    const listener = (_: unknown, evt: unknown) => cb(evt);
    ipcRenderer.on("apos:agent-event", listener);
    return () => ipcRenderer.removeListener("apos:agent-event", listener);
  },
};

contextBridge.exposeInMainWorld("apos", api);
