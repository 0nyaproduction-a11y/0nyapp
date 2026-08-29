import { AsyncLocalStorage } from "node:async_hooks";

export type PerfMarker = {
  name: string;
  durationMs: number;
};

export class PerfCollector {
  readonly traceId: string;
  readonly t0: number;
  private markers: PerfMarker[] = [];

  constructor() {
    this.traceId = `perf-${Math.random().toString(36).slice(2, 9)}`;
    this.t0 = performance.now();
  }

  addMarker(name: string, durationMs: number) {
    this.markers.push({ name, durationMs });
  }

  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const end = performance.now();
      this.addMarker(name, end - start);
    }
  }

  getServerTimingHeader(): string {
    const totalMs = performance.now() - this.t0;
    const parts = this.markers.map(
      (m) => `${m.name};dur=${m.durationMs.toFixed(2)}`,
    );
    parts.push(`handler;dur=${totalMs.toFixed(2)}`);
    return parts.join(", ");
  }

  applyHeaders(res: Response): Response {
    res.headers.set("Server-Timing", this.getServerTimingHeader());
    res.headers.set("X-Perf-Trace-Id", this.traceId);
    return res;
  }
}

const perfStorage = new AsyncLocalStorage<PerfCollector>();

export function getPerfCollector(): PerfCollector | undefined {
  return perfStorage.getStore();
}

export function runWithPerf<T>(collector: PerfCollector, fn: () => Promise<T>): Promise<T> {
  return perfStorage.run(collector, fn);
}

export async function timePerf<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const collector = getPerfCollector();
  if (collector) {
    return collector.time(name, fn);
  }
  return fn();
}
