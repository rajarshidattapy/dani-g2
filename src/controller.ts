import type { Executor, QueueSource, Receipt } from './model';
import { finishRun, initialState, openItem, reduce, type Input, type State } from './store';
import { render, type Page } from './view';

export interface Storage {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<unknown>;
}

const RECEIPTS_KEY = 'dani-g2.receipts.v1';

/** Owns state, runs approvals, persists receipts. UI-agnostic so tests can drive it without glasses. */
export class Controller {
  state!: State;
  private busy = false;
  constructor(
    private source: QueueSource,
    private executor: Executor,
    private storage: Storage,
    private onPage: (p: Page) => Promise<void> | void,
    private log: (m: string) => void = () => {},
  ) {}

  async start(): Promise<void> {
    const snap = await this.source.load();
    let receipts: Receipt[] = [];
    try {
      const raw = await this.storage.get(RECEIPTS_KEY);
      if (raw) receipts = JSON.parse(raw) as Receipt[];
    } catch {
      this.log('could not read saved receipts, starting clean');
    }
    this.state = initialState(snap.label, snap.items, receipts);
    await this.push();
  }

  async handle(input: Input): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const before = this.state;
      this.state = reduce(before, input);
      if (this.state.receipts.length !== before.receipts.length) await this.save();
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
    await this.save();
    await this.push();
  }

  private async save(): Promise<void> {
    await this.storage.set(RECEIPTS_KEY, JSON.stringify(this.state.receipts));
  }

  private async push(): Promise<void> {
    await this.onPage(render(this.state));
  }
}
