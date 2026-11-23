export type ActionKind = 'reply' | 'schedule' | 'share';
export type AppName = 'gmail' | 'calendar' | 'drive';

/** One thing Dani wants to do on the user's behalf. Nothing runs until the user approves it. */
export interface ActionItem {
  id: string;
  kind: ActionKind;
  app: AppName;
  title: string;
  from: string;
  draft: string;
  /** Sample source only: makes the first execution fail so the retry path is visible. */
  sampleFailOnce?: boolean;
}

export type Outcome = 'done' | 'skipped' | 'rejected';

export interface Receipt {
  itemId: string;
  title: string;
  outcome: Outcome;
  /** Reference returned by the executor, for example a message id. */
  ref: string;
  at: string;
}

export interface QueueSnapshot {
  /** Shown on the glasses header. "SAMPLE DATA" for the bundled demo source. */
  label: string;
  items: ActionItem[];
}

export interface QueueSource {
  load(): Promise<QueueSnapshot>;
}

export type ExecResult = { ok: true; ref: string } | { ok: false; reason: string };

export interface Executor {
  approve(item: ActionItem): Promise<ExecResult>;
}
