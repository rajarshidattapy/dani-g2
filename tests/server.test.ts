import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module
import { createApp } from '../server/app.mjs';
import { HttpExecutor, HttpSource } from '../src/adapters';

const open: Server[] = [];
afterEach(() => open.splice(0).forEach((s) => s.close()));

async function start(opts: Record<string, unknown> = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'dani-')), 'db.json');
  const srv: Server = createApp({ file, ...opts });
  open.push(srv);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  return { base: `http://127.0.0.1:${port}`, file };
}
const post = (url: string, body?: unknown, token?: string) =>
  fetch(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers: token ? { authorization: `Bearer ${token}` } : {} });
const item = (id: string) => ({ id, title: `T ${id}`, draft: 'D', from: 'F' });

describe('reference backend + client adapters', () => {
  it('enqueue, list, and load through HttpSource', async () => {
    const { base } = await start();
    expect((await post(`${base}/queue`, { items: [item('a'), item('b')] })).status).toBe(201);
    const snap = await new HttpSource(base).load();
    expect(snap.label).toBe('LIVE');
    expect(snap.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('rejects malformed and duplicate items', async () => {
    const { base } = await start();
    expect((await post(`${base}/queue`, { id: 'x' })).status).toBe(400);
    await post(`${base}/queue`, item('a'));
    expect((await post(`${base}/queue`, item('a'))).status).toBe(409);
  });

  it('approve without a handler records only and says so', async () => {
    const { base } = await start();
    await post(`${base}/queue`, item('a'));
    const res = await post(`${base}/actions/a/approve`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recorded_only).toBe(true);
    expect((await (await fetch(`${base}/queue`)).json()).items).toEqual([]);
    expect((await (await fetch(`${base}/log`)).json()).log[0]).toMatchObject({ id: 'a', outcome: 'approved' });
  });

  it('approve calls the handler; a failing handler keeps the item and returns the error', async () => {
    let mode: 'ok' | 'fail' = 'fail';
    const received: unknown[] = [];
    const handler = createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        received.push(JSON.parse(b));
        res.writeHead(mode === 'ok' ? 200 : 500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ref: 'msg-123' }));
      });
    });
    open.push(handler);
    await new Promise<void>((r) => handler.listen(0, '127.0.0.1', r));
    const handlerUrl = `http://127.0.0.1:${(handler.address() as { port: number }).port}/h`;
    const { base } = await start({ handlerUrl });
    await post(`${base}/queue`, item('a'));
    const exec = new HttpExecutor(base);
    const bad = await exec.approve(item('a'));
    expect(bad).toEqual({ ok: false, reason: 'handler returned HTTP 500' });
    expect((await new HttpSource(base).load()).items).toHaveLength(1);
    mode = 'ok';
    expect(await exec.approve(item('a'))).toEqual({ ok: true, ref: 'msg-123' });
    expect((received[0] as { item: { id: string } }).item.id).toBe('a');
    expect((await new HttpSource(base).load()).items).toHaveLength(0);
  });

  it('skip and reject are recorded through the executor', async () => {
    const { base } = await start();
    await post(`${base}/queue`, { items: [item('a'), item('b')] });
    const exec = new HttpExecutor(base);
    await exec.resolve(item('a'), 'skipped');
    await exec.resolve(item('b'), 'rejected');
    const log = (await (await fetch(`${base}/log`)).json()).log.map((l: { outcome: string }) => l.outcome);
    expect(log).toEqual(['skipped', 'rejected']);
  });

  it('requires the bearer token when one is configured', async () => {
    const { base } = await start({ token: 'secret' });
    expect((await fetch(`${base}/queue`)).status).toBe(401);
    expect((await post(`${base}/queue`, item('a'), 'secret')).status).toBe(201);
    expect((await new HttpSource(base, 'secret').load()).items).toHaveLength(1);
    await expect(new HttpSource(base, 'wrong').load()).rejects.toThrow('HTTP 401');
  });

  it('persists to disk across restarts', async () => {
    const { base, file } = await start();
    await post(`${base}/queue`, item('a'));
    const again = createApp({ file });
    open.push(again);
    await new Promise<void>((r) => again.listen(0, '127.0.0.1', r));
    const b2 = `http://127.0.0.1:${(again.address() as { port: number }).port}`;
    expect((await new HttpSource(b2).load()).items.map((i) => i.id)).toEqual(['a']);
  });

  it('client reports an unreachable backend as an error, not a crash', async () => {
    await expect(new HttpSource('http://127.0.0.1:1').load()).rejects.toThrow();
    expect((await new HttpExecutor('http://127.0.0.1:1').approve(item('a'))).ok).toBe(false);
  });
});
