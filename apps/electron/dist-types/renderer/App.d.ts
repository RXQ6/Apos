type Mode = "explore" | "ask" | "allow-all";
type Feature = {
    id: string;
    title: string;
    harnessStatus: string;
    priority: string;
};
declare global {
    interface Window {
        apos?: {
            init: () => Promise<{
                features: Feature[];
                mode: Mode;
                repoRoot: string;
            }>;
            setMode: (m: Mode) => Promise<unknown>;
            newSession: () => Promise<{
                id: string;
            }>;
            send: (text: string) => Promise<unknown>;
            onAgentEvent: (cb: (evt: {
                type: string;
                payload: unknown;
            }) => void) => () => void;
        };
    }
}
export declare function App(): import("react").JSX.Element;
export {};
