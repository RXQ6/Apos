import { useEffect, useRef, useState } from "react";

type Mode = "explore" | "ask" | "allow-all";
type Feature = { id: string; title: string; harnessStatus: string; priority: string };
type Msg = { role: string; text: string; ts: number };
type SessionRow = { id: string; title: string; permission_mode: string; updated_at: number };
type ProviderRow = {
  id: string;
  label: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

declare global {
  interface Window {
    apos?: {
      init: () => Promise<{
        features: Feature[];
        mode: Mode;
        repoRoot: string;
        sessions: SessionRow[];
        providers: ProviderRow[];
      }>;
      setMode: (m: Mode) => Promise<unknown>;
      saveProviders: (c: unknown[]) => Promise<unknown>;
      newSession: () => Promise<{ id: string }>;
      resumeSession: (id: string) => Promise<unknown>;
      send: (text: string) => Promise<unknown>;
      onAgentEvent: (cb: (evt: { type: string; payload: unknown }) => void) => () => void;
    };
  }
}

export function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [mode, setMode] = useState<Mode>("ask");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [providerId, setProviderId] = useState("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.apos;
    if (!api) return;
    void api.init().then((s) => {
      setFeatures(s.features ?? []);
      setMode(s.mode ?? "ask");
      setSessions(s.sessions ?? []);
      const p = s.providers?.[0];
      if (p) {
        setProviderId(p.id);
        setBaseUrl(p.baseUrl ?? "");
        setModel(p.model ?? "");
      }
    });
    const off = api.onAgentEvent((evt) => {
      if (evt.type === "token") {
        const token = String(evt.payload ?? "");
        setMsgs((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant-stream") {
            return [...prev.slice(0, -1), { ...last, text: last.text + token }];
          }
          return [...prev, { role: "assistant-stream", text: token, ts: Date.now() }];
        });
      }
      if (evt.type === "message") {
        const m = evt.payload as Msg;
        if (m.role === "assistant") {
          setMsgs((prev) => [
            ...prev.filter((x) => x.role !== "assistant-stream"),
            m,
          ]);
        } else {
          setMsgs((prev) => [...prev, m]);
        }
      }
    });
    return off;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    const api = window.apos;
    if (!api || !input.trim() || busy) return;
    setBusy(true);
    const text = input;
    setInput("");
    try {
      await api.send(text);
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(m: Mode) {
    setMode(m);
    await window.apos?.setMode(m);
  }

  async function saveProvider() {
    await window.apos?.saveProviders([
      {
        id: providerId,
        label: providerId,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
        apiKey: apiKey || undefined,
      },
    ]);
    setShowSettings(false);
    setMsgs((p) => [
      ...p,
      {
        role: "assistant",
        text: apiKey
          ? "Provider 已保存（含 Key）。新会话将尝试走 LLM。"
          : "Provider 元数据已保存（无 Key，仍为 echo）。",
        ts: Date.now(),
      },
    ]);
  }

  return (
    <div className="layout">
      <aside className="side">
        <h1>Apos</h1>
        <p className="tag">景枢 · 场景规划</p>
        <div className="modes">
          {(["explore", "ask", "allow-all"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? "on" : ""}
              onClick={() => void changeMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="button" className="settings-btn" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "关闭设置" : "模型设置"}
        </button>
        {showSettings && (
          <div className="settings">
            <label>
              Provider
              <input value={providerId} onChange={(e) => setProviderId(e.target.value)} />
            </label>
            <label>
              Base URL
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </label>
            <button type="button" onClick={() => void saveProvider()}>
              保存
            </button>
          </div>
        )}
        <h2>Sessions</h2>
        <ul className="feat">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="linkish"
                onClick={() => void window.apos?.resumeSession(s.id)}
              >
                {s.title.slice(0, 18)}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="linkish" onClick={() => void window.apos?.newSession()}>
              + 新会话
            </button>
          </li>
        </ul>
        <h2>Features ({features.length})</h2>
        <ul className="feat">
          {features.slice(0, 30).map((f) => (
            <li key={f.id}>
              <span className={`st st-${f.harnessStatus}`}>{f.harnessStatus}</span>
              <span>{f.id}</span>
            </li>
          ))}
        </ul>
      </aside>
      <main className="chat">
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={`${m.ts}-${i}`} className={`msg msg-${m.role}`}>
              <div className="who">{m.role}</div>
              <div className="body">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="composer">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder="/catalog_publish  /cart_add  /order_create  /payment_callback  /tools"
          />
          <button type="button" onClick={() => void send()} disabled={busy}>
            发送
          </button>
        </div>
      </main>
    </div>
  );
}
