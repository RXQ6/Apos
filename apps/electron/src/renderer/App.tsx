import { useEffect, useRef, useState } from "react";

type Mode = "explore" | "ask" | "allow-all";
type Feature = {
  id: string;
  title: string;
  harnessStatus: string;
  priority: string;
};
type Msg = { role: string; text: string; ts: number };

declare global {
  interface Window {
    apos?: {
      init: () => Promise<{
        features: Feature[];
        mode: Mode;
        repoRoot: string;
      }>;
      setMode: (m: Mode) => Promise<unknown>;
      newSession: () => Promise<{ id: string }>;
      send: (text: string) => Promise<unknown>;
      onAgentEvent: (cb: (evt: { type: string; payload: unknown }) => void) => () => void;
    };
  }
}

export function App() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [mode, setMode] = useState<Mode>("ask");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.apos;
    if (!api) return;
    void api.init().then((s) => {
      setFeatures(s.features ?? []);
      setMode(s.mode ?? "ask");
    });
    const off = api.onAgentEvent((evt) => {
      if (evt.type === "token") {
        const token = String(evt.payload ?? "");
        setMsgs((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant-stream") {
            const copy = prev.slice(0, -1);
            return [...copy, { ...last, text: last.text + token }];
          }
          return [...prev, { role: "assistant-stream", text: token, ts: Date.now() }];
        });
      }
      if (evt.type === "message") {
        const m = evt.payload as Msg;
        if (m.role === "assistant") {
          setMsgs((prev) => {
            const withoutStream = prev.filter((x) => x.role !== "assistant-stream");
            return [...withoutStream, m];
          });
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
        <h2>Features ({features.length})</h2>
        <ul className="feat">
          {features.map((f) => (
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
            placeholder="/feature_list_read  ·  /verify_run  ·  /tools"
          />
          <button type="button" onClick={() => void send()} disabled={busy}>
            发送
          </button>
        </div>
      </main>
    </div>
  );
}
