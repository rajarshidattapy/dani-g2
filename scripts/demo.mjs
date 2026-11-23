// Drives the running simulator through the full flow and saves one glasses screenshot per step.
// Needs: `npm run dev` and a simulator started with --automation-port 9898 (see README).
// Output: demo/steps/NN-name.png and demo/steps.json (captions + hold times for make-video.sh).
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.SIM ?? 'http://127.0.0.1:9898';
const OUT = 'demo/steps';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = (action) =>
  fetch(`${BASE}/api/input`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
const shot = async (file) => {
  const res = await fetch(`${BASE}/api/screenshot/glasses`);
  await writeFile(`${OUT}/${file}`, Buffer.from(await res.arrayBuffer()));
};

await mkdir(OUT, { recursive: true });
const steps = [];
let n = 0;
async function step(caption, hold, actions, { wait = 700, name } = {}) {
  for (const a of actions) {
    await input(a);
    await sleep(wait);
  }
  if (actions.length === 0) await sleep(wait);
  const file = `${String(++n).padStart(2, '0')}-${name ?? 'step'}.png`;
  await shot(file);
  steps.push({ file, caption, hold });
}

await step('Dani sorted your inbox, calendar and files overnight. Four actions need your OK.', 4, [], { name: 'brief' });
await step('Open the review queue.', 3, ['click'], { name: 'queue' });
await step('Open the first draft. Nothing sends until you approve it.', 5, ['click'], { name: 'detail' });
await step('Approve with one click on the temple or ring.', 3, ['click'], { wait: 250, name: 'running' });
await step('Done. Every action leaves a receipt.', 4, [], { wait: 1500, name: 'receipt' });
await step('Back to the queue: three left.', 3, ['click'], { name: 'queue2' });
await step('Open the file-share request.', 3, ['down', 'click'], { name: 'detail2' });
await step('Approve it. This run fails on purpose (simulated), so you can see the failure path.', 4, ['click'], { wait: 1600, name: 'error' });
await step('Retry from the glasses.', 4, ['click'], { wait: 1700, name: 'retried' });
await step('Next: a calendar change.', 3, ['click', 'click'], { name: 'detail3' });
await step('Not sure? Reject or skip. Dani drops it and logs it.', 4, ['down', 'down', 'click'], { name: 'rejected' });
await step('Skip the last one.', 3, ['click', 'click', 'down', 'click', 'click'], { name: 'last' });
await step('Queue clear. Receipts list what ran, what was skipped, what was rejected.', 4, ['click', 'down', 'click'], { name: 'receipts' });
await writeFile('demo/steps.json', JSON.stringify(steps, null, 2));
console.log(`saved ${steps.length} steps in ${OUT}`);
