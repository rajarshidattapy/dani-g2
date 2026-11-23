import { describe, expect, it } from 'vitest';
import { Controller } from '../src/controller';
import type { ActionItem, Executor, QueueSource } from '../src/model';
import { SimulatedExecutor } from '../src/adapters';
import { finishRun, initialState, reduce } from '../src/store';
import { H, listName, render, W } from '../src/view';
import { toInput } from '../src/glasses';
import { OsEventTypeList } from '@evenrealities/even_hub_sdk';

const items: ActionItem[] = [
  { id: 'a', kind: 'reply', app: 'gmail', title: 'Reply: invoice', from: 'Test', draft: 'Draft A' },
  { id: 'b', kind: 'share', app: 'drive', title: 'Share deck', from: 'Test', draft: 'Draft B', sampleFailOnce: true },
];
const NOW = new Date('2026-11-23T10:00:00Z');

describe('reducer', () => {
  it('walks brief -> queue -> detail -> running', () => {
    let s = initialState('TEST', items);
    s = reduce(s, { type: 'click', index: 0 });
    expect(s.screen).toBe('queue');
    s = reduce(s, { type: 'click', index: 1 });
    expect(s.screen).toBe('detail');
    expect(s.current).toBe(1);
    s = reduce(s, { type: 'click', index: 0 });
    expect(s.screen).toBe('running');
  });

  it('never approves without an explicit approve choice', () => {
    let s = initialState('TEST', items);
    s = reduce(reduce(s, { type: 'click', index: 0 }), { type: 'click', index: 0 });
    expect(s.screen).toBe('detail');
    s = reduce(s, { type: 'back' });
    expect(s.screen).toBe('queue');
    expect(s.receipts).toHaveLength(0);
  });

  it('skip and reject leave a receipt and remove the item', () => {
    let s = initialState('TEST', items);
    s = reduce(reduce(s, { type: 'click', index: 0 }), { type: 'click', index: 0 });
    s = reduce(s, { type: 'click', index: 1 }, NOW);
    expect(s.screen).toBe('receipt');
    expect(s.receipts[0]).toMatchObject({ itemId: 'a', outcome: 'skipped' });
    expect(s.pending.map((p) => p.id)).toEqual(['b']);
    s = reduce(s, { type: 'click', index: 0 });
    s = reduce(s, { type: 'click', index: 0 });
    s = reduce(s, { type: 'menu', id: 3 }, NOW);
    expect(s.receipts[1]).toMatchObject({ itemId: 'b', outcome: 'rejected' });
    expect(s.screen).toBe('receipt');
    expect(reduce(s, { type: 'click', index: 0 }).screen).toBe('brief');
  });

  it('failure offers retry, then success records done', () => {
    let s = initialState('TEST', items);
    s = reduce(reduce(s, { type: 'click', index: 0 }), { type: 'click', index: 0 });
    s = reduce(s, { type: 'click', index: 0 });
    s = finishRun(s, { ok: false, reason: 'boom' });
    expect(s.screen).toBe('error');
    expect(s.pending).toHaveLength(2);
    s = reduce(s, { type: 'click', index: 0 });
    expect(s.screen).toBe('running');
    s = finishRun(s, { ok: true, ref: 'r1' }, NOW);
    expect(s.receipts[0]).toMatchObject({ outcome: 'done', ref: 'r1' });
  });

  it('ignores input while an approval is running', () => {
    let s = initialState('TEST', items);
    s = reduce(reduce(s, { type: 'click', index: 0 }), { type: 'click', index: 0 });
    s = reduce(s, { type: 'click', index: 0 });
    expect(reduce(s, { type: 'click', index: 1 })).toBe(s);
  });

  it('drops items that already have a saved receipt', () => {
    const s = initialState('TEST', items, [
      { itemId: 'a', title: 'x', outcome: 'done', ref: 'r', at: NOW.toISOString() },
    ]);
    expect(s.pending.map((p) => p.id)).toEqual(['b']);
  });
});

describe('view', () => {
  it('stays inside the 576x288 display and the container limits', () => {
    let s = initialState('SAMPLE DATA', items);
    const screens = [s];
    s = reduce(s, { type: 'click', index: 0 });
    screens.push(s);
    s = reduce(s, { type: 'click', index: 0 });
    screens.push(s, { ...s, screen: 'running' }, { ...s, screen: 'error', failure: 'x'.repeat(300) }, { ...s, screen: 'receipts' });
    for (const st of screens) {
      const p = render(st);
      const boxes = [...p.texts, ...(p.list ? [p.list] : [])];
      expect(boxes.length).toBeLessThanOrEqual(12);
      expect(p.texts.length).toBeLessThanOrEqual(8);
      for (const b of boxes) {
        expect(b.x + b.w).toBeLessThanOrEqual(W);
        expect(b.y + b.h).toBeLessThanOrEqual(H);
      }
      for (const t of p.texts) expect(new TextEncoder().encode(t.content).length).toBeLessThanOrEqual(999);
      for (const i of p.list?.items ?? []) expect(new TextEncoder().encode(i).length).toBeLessThanOrEqual(63);
      expect((p.list?.items.length ?? 0) <= 20).toBe(true);
    }
  });

  it('shows the data label so sample data is never mistaken for real data', () => {
    const p = render(initialState('SAMPLE DATA', items));
    expect(p.texts[0]!.content).toContain('SAMPLE DATA');
  });

  it('clips long list names to 63 bytes', () => {
    expect(new TextEncoder().encode(listName('é'.repeat(80))).length).toBeLessThanOrEqual(63);
  });

  it('detail screen registers a context menu with unique ids', () => {
    let s = initialState('T', items);
    s = reduce(reduce(s, { type: 'click', index: 0 }), { type: 'click', index: 0 });
    const ids = render(s).menu!.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => i > 0)).toBe(true);
  });
});

describe('controller', () => {
  const source: QueueSource = { load: async () => ({ label: 'TEST', items }) };
  const mem = () => {
    const m = new Map<string, string>();
    return { get: async (k: string) => m.get(k) ?? '', set: async (k: string, v: string) => void m.set(k, v), m };
  };

  it('runs the executor only after approve and persists the receipt', async () => {
    const calls: string[] = [];
    const exec: Executor = { approve: async (i) => (calls.push(i.id), { ok: true, ref: 'ok-' + i.id }) };
    const store = mem();
    const c = new Controller(source, exec, store, () => {});
    await c.start();
    await c.handle({ type: 'click', index: 0 });
    await c.handle({ type: 'click', index: 0 });
    expect(calls).toEqual([]);
    await c.handle({ type: 'click', index: 0 });
    expect(calls).toEqual(['a']);
    expect(c.state.screen).toBe('receipt');
    expect(JSON.parse(store.m.get('dani-g2.receipts.v1')!)).toHaveLength(1);
    const c2 = new Controller(source, exec, store, () => {});
    await c2.start();
    expect(c2.state.pending.map((p) => p.id)).toEqual(['b']);
  });

  it('simulated executor fails once for the flagged item, then succeeds', async () => {
    const ex = new SimulatedExecutor(1);
    expect((await ex.approve(items[1]!)).ok).toBe(false);
    expect((await ex.approve(items[1]!)).ok).toBe(true);
    expect((await ex.approve(items[0]!)).ok).toBe(true);
  });
});

describe('event mapping', () => {
  it('treats a list event with no eventType as a click', () => {
    const ev = { listEvent: { currentSelectItemIndex: 2 } } as never;
    expect(toInput(ev)).toEqual({ type: 'click', index: 2 });
  });
  it('maps double click to back and menu clicks to menu', () => {
    expect(toInput({ textEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT } } as never)).toEqual({ type: 'back' });
    expect(toInput({ menuItemClickEvent: { itemID: 2 } } as never)).toEqual({ type: 'menu', id: 2 });
  });
  it('ignores scroll and foreground events', () => {
    expect(toInput({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } } as never)).toBeUndefined();
  });
});
