type Handler = (payload: Record<string, unknown>) => void;

const handlers = new Map<string, Set<Handler>>();

export function on(event: string, handler: Handler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

export function emit(event: string, payload: Record<string, unknown>): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload);
    } catch {
      /* isolate handler errors */
    }
  }
}

export function clearEvents(): void {
  handlers.clear();
}
