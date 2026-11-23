import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { HttpExecutor, HttpSource, SampleSource, SimulatedExecutor } from './adapters';
import { Controller } from './controller';
import { GlassesView, toInput } from './glasses';

const logEl = document.getElementById('log');
const log = (m: string) => {
  console.log(`[dani-g2] ${m}`);
  if (logEl) logEl.textContent += `${m}\n`;
};

async function boot() {
  const params = new URLSearchParams(location.search);
  const backend = params.get('backend'); // e.g. ?backend=https://my-agent.example.com&token=...
  const token = params.get('token') ?? undefined;
  const source = backend ? new HttpSource(backend, token) : new SampleSource();
  const executor = backend ? new HttpExecutor(backend, token) : new SimulatedExecutor();
  log(backend ? `backend: ${backend}` : 'no backend set: using the bundled SAMPLE queue');

  const bridge = await waitForEvenAppBridge();
  const view = new GlassesView(bridge);
  const app = new Controller(
    source,
    executor,
    { get: (k) => bridge.getLocalStorage(k), set: (k, v) => bridge.setLocalStorage(k, v) },
    (p) => view.show(p),
    log,
  );
  bridge.onEvenHubEvent((event) => {
    const input = toInput(event);
    if (input) void app.handle(input).catch((e) => log(`error: ${e instanceof Error ? e.message : e}`));
  });
  await app.start();
  log('ready');
}

boot().catch((e) => log(`boot failed: ${e instanceof Error ? e.message : e}`));
