// TTL + request deduplication. Invalidation also obsoletes requests already in flight.
export function createResponseCache<T>(ttlMs: number) {
  let generation = 0;
  const values = new Map<string, { expiresAt: number; value: T }>();
  const inFlight = new Map<string, Promise<T>>();
  return {
    clear() { generation += 1; values.clear(); inFlight.clear(); },
    get(key: string, load: () => Promise<T>, publish?: (value: T) => void): Promise<T> {
      const cached = values.get(key);
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
      const existing = inFlight.get(key);
      if (existing) return existing;
      const started = generation;
      const request = load().then((value) => {
        if (started !== generation) throw new Error("This access request is obsolete.");
        values.set(key, { value, expiresAt: Date.now() + ttlMs });
        publish?.(value);
        return value;
      }).finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
      inFlight.set(key, request);
      return request;
    },
  };
}
