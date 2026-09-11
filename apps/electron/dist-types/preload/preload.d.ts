export interface AposApi {
    init: () => Promise<unknown>;
    setMode: (mode: "explore" | "ask" | "allow-all") => Promise<unknown>;
    newSession: () => Promise<unknown>;
    send: (text: string) => Promise<unknown>;
    listFeatures: () => Promise<unknown>;
    onAgentEvent: (cb: (evt: unknown) => void) => () => void;
}
