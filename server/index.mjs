// Usage: DANI_TOKEN=secret node server/index.mjs        (see README, "Reference backend")
import { createApp } from './app.mjs';

const port = Number(process.env.PORT ?? 8787);
const token = process.env.DANI_TOKEN;
const host = process.env.HOST ?? (token ? '0.0.0.0' : '127.0.0.1');
const handlerUrl = process.env.DANI_HANDLER_URL;
const file = process.env.DANI_DATA ?? new URL('./data.json', import.meta.url).pathname;

createApp({ file, token, handlerUrl }).listen(port, host, () => {
  console.log(`dani-g2 backend on http://${host}:${port}`);
  if (!token) console.log('DANI_TOKEN is not set: listening on localhost only, no auth.');
  console.log(handlerUrl ? `approve -> POST ${handlerUrl}` : 'DANI_HANDLER_URL is not set: approve only records the decision.');
});
