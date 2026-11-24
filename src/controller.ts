import type { Executor, QueueSource, Receipt } from './model';
import { finishRun, initialState, offlineState, openItem, reduce, type Input, type State } from './store';
import { render, type Page } from './view';

export interface Storage {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<unknown>;
}

const RECEIPTS_KEY = 'dani-g2.receipts.v1';
const MAX_RECEIPTS = 200;

/** Owns state, runs approvals, persists receipts. UI-agnostic so tests can drive it without glasses. */
export class Controller {
  state: State;
  private busy = false;
  private receipts: Receipt[] = [];

  constructor(
    private source: QueueSource | undefined,
    private executor: Executor,
    private storage: Storage,
    private onPage: (p: Page) => Promise<void> | void,
    private log: (m: string) => void = () => {},
  ) {
    this.state = offlineState('NOT CONNECTED', 'Starting…');
  }

  async start(): Promise<void> {
    try {
      const raw = await this.storage.get(RECEIPTS_KEY);
      if (raw) this.receipts = (JSON.parse(raw) as Receipt[]).slice(-MAX_RECEIPTS);
    } catch {
      this.log('could not read saved receipts, starting clean');
    }
    await this.reload();
  }

  /** Fetch the queue again. Keeps receipts; a failure shows an offline screen with Try again. */
  async reload(): Promise<void> {
    if (!this.source) {
      this.state = offlineState('NOT CONNECTED', 'No backend set. Open the app with ?backend=URL (see README).', this.receipts);
    } else {
      try {
        const snap = await this.source.load();
        this.state = initialState(snap.label, snap.items, this.receipts);
      } catch (e) {
        const why = e instanceof Error ? e.message : 'unknown error';
        this.log(`load failed: ${why}`);
        this.state = offlineState('OFFLINE', `Could not load the queue: ${why}`, this.receipts);
      }
    }
    await this.push();
  }

  async handle(input: Input): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const s = this.state;
      if (input.type === 'click' && (s.screen === 'offline' || (s.screen === 'brief' && input.index === 2))) {
        await this.reload();
        return;
      }
      const item = openItem(s);
      this.state = reduce(s, input);
      if (this.state.receipts.length !== s.receipts.length) {
        const r = this.state.receipts[this.state.receipts.length - 1]!;
        this.receipts = this.state.receipts;
        await this.save();
        if (item && r.outcome !== 'done') await this.executor.resolve(item, r.outcome);
      }
      await this.push();
      if (this.state.screen === 'running') await this.run();
    } finally {
      this.busy = false;
    }
  }

  private async run(): Promise<void> {
    const item = openItem(this.state);
    if (!item) return;
    this.log(`approve ${item.id}`);
    const result = await this.executor.approve(item);
    this.state = finishRun(this.state, result);
    if (result.ok) {
      this.receipts = this.state.receipts;
      await this.save();
    }
    await this.push();
  }

  private async save(): Promise<void> {
    await this.storage.set(RECEIPTS_KEY, JSON.stringify(this.receipts.slice(-MAX_RECEIPTS)));
  }

  private async push(): Promise<void> {
    await this.onPage(render(this.state));
  }
}
