import type { ActionItem, ExecResult, Executor, QueueSnapshot, QueueSource } from './model';

/** Loads the bundled synthetic queue. The label tells the user it is not real data. */
export class SampleSource implements QueueSource {
  constructor(private url = './queue.sample.json') {}
  async load(): Promise<QueueSnapshot> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`sample queue: HTTP ${res.status}`);
    const j = (await res.json()) as { label?: string; items: ActionItem[] };
    return { label: j.label ?? 'SAMPLE DATA', items: j.items };
  }
}

/**
 * Reads a queue from any agent backend that serves `GET {base}/queue` with
 * `{ items: ActionItem[] }`. This is the integration point for a real Dani.
 */
export class HttpSource implements QueueSource {
  constructor(private base: string, private token?: string) {}
  async load(): Promise<QueueSnapshot> {
    const res = await fetch(`${this.base}/queue`, { headers: authHeaders(this.token) });
    if (!res.ok) throw new Error(`queue: HTTP ${res.status}`);
    const j = (await res.json()) as { items: ActionItem[] };
    return { label: 'LIVE', items: j.items };
  }
}

export class HttpExecutor implements Executor {
  constructor(private base: string, private token?: string) {}
  async approve(item: ActionItem): Promise<ExecResult> {
    try {
      const res = await fetch(`${this.base}/actions/${encodeURIComponent(item.id)}/approve`, {
        method: 'POST',
        headers: authHeaders(this.token),
      });
      if (!res.ok) return { ok: false, reason: `server said HTTP ${res.status}` };
      const j = (await res.json()) as { ref?: string };
      return { ok: true, ref: j.ref ?? item.id };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'network error' };
    }
  }
}

/**
 * Pretends to run an action. It does not send mail, edit calendars or share files.
 * Used only with the sample source so the full flow (including a failure and retry) can be shown.
 */
export class SimulatedExecutor implements Executor {
  private failed = new Set<string>();
  constructor(private delayMs = 900) {}
  async approve(item: ActionItem): Promise<ExecResult> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (item.sampleFailOnce && !this.failed.has(item.id)) {
      this.failed.add(item.id);
      return { ok: false, reason: 'Simulated failure: share service timed out.' };
    }
    return { ok: true, ref: `sim-${item.id}` };
  }
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
