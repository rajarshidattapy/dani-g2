# Dani on G2

Your AI assistant's to-do list, cleared from your glasses.

Dani on G2 is an [Even Hub](https://www.evenrealities.com) app for Even Realities G2. An assistant (Dani) prepares actions on your behalf: reply to an email, move a meeting, share a file. The glasses show each one as a short draft. You approve, skip or reject it with the temple or ring. Nothing runs until you approve, and every outcome leaves a receipt.

Built for the Even Realities hackathon, Track 4 (AI assistants). Submitted by Dan Lab.

![Draft screen](demo/steps/03-detail.png)

## What it does

| Screen | What you see | Input |
| --- | --- | --- |
| Brief | How many actions wait, the next one | Click to open the queue or receipts |
| Queue | One line per pending action, tagged MAIL / CAL / DRIVE | Scroll, click to open |
| Draft | Title, sender, the exact draft text, then Approve / Skip / Reject | Click an option, or long-press for the same three in the context menu. Double-click goes back |
| Running | What is being run | Input is ignored until it finishes |
| Receipt | Done, skipped or rejected, with a reference | Click to continue |
| Failed | Why it did not run, then Retry / Skip it | Click |
| Receipts | The last four outcomes | Double-click or click to go back |

Receipts are saved in the Even App's local storage (last 200). A saved approval, skip or reject hides that item id on later loads, so the queue is not shown twice.

## Two modes

**Backend mode (the real app).** Open the page with `?backend=<url>` and optionally `&token=<bearer>`. The glasses header says `LIVE`. The app calls:

- `GET {backend}/queue` returns `{ "items": ActionItem[] }`
- `POST {backend}/actions/{id}/approve` returns `{ "ref": "..." }`, or a non-2xx reply with `{ "error": "..." }` (shown on the glasses, with Retry)
- `POST {backend}/actions/{id}/skip` and `/reject` tell the backend about decisions (best effort; the on-device receipt is kept either way)

`ActionItem` is `{ id, title, draft, from?, app? }` (`src/model.ts`). Payloads are validated: malformed or duplicate items are dropped, and the list is capped at the glasses' 20-row limit. Requests time out after 10 seconds. If the backend is down the glasses show an offline screen with "Try again".

With no `?backend=` and no `?demo=1` the app shows "NOT CONNECTED". It never falls back to fake data.

**Demo mode (`?demo=1`).** Loads four made-up items from `public/queue.sample.json` and uses a simulated executor that sends nothing and touches no account. The header says `SAMPLE DATA`. It fails the file-share item once on purpose so the retry screen can be shown. This is what the demo video uses.

### Reference backend

`server/` is a small dependency-free Node server that implements the contract above, with a file-backed queue and an audit log:

```bash
DANI_TOKEN=change-me node server/index.mjs                  # port 8787
curl -X POST localhost:8787/queue -H 'authorization: Bearer change-me' \
  -d '{"id":"m1","title":"Reply: standup","from":"Team","draft":"Notes are in the doc.","app":"gmail"}'
```

An assistant adds drafts with `POST /queue`. On approve, the server POSTs `{ "item": ... }` to `DANI_HANDLER_URL` if you set one; a 2xx reply counts as done and may return `{ "ref": "..." }`, a failure keeps the item pending so Retry works. **If `DANI_HANDLER_URL` is not set, approve only records the decision.** The reply is marked `recorded_only` and the glasses show "Recorded. Nothing was sent." The server does not send mail, edit calendars or share files by itself. Without `DANI_TOKEN` it listens on localhost only.

## How it is built

```
src/model.ts       types: ActionItem, Receipt, QueueSource, Executor
src/store.ts       pure reducer: screen + input -> next screen (no I/O)
src/view.ts        state -> page description (576x288, container limits enforced)
src/glasses.ts     page -> Even Hub SDK containers; SDK events -> app input
src/controller.ts  runs approvals, saves receipts
src/adapters.ts    HTTP source and executor (timeouts, error bodies); demo-only sample source and simulated executor
src/validate.ts    validates untrusted backend payloads
server/            reference backend (tested end to end against the real client code)
```

The reducer and view have no SDK imports, so they are tested directly. Built with [`@evenrealities/even_hub_sdk`](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) 0.0.16 and tested in [`@evenrealities/evenhub-simulator`](https://www.npmjs.com/package/@evenrealities/evenhub-simulator) 0.9.5.

## Status and limits

- Tested in the simulator only. It has not been run on physical G2 glasses.
- Unit and integration tests run in CI (`.github/workflows/ci.yml`). The glasses UI itself is checked by running the simulator, not by automated tests.
- The simulator reports the same source for temple and ring input, so ring behavior is untested.
- Skipping or rejecting in the app is reversible only in the backend you connect. The app keeps no undo.
- The reference backend has no multi-user support, rate limiting or TLS. Put it behind a proxy if you expose it.
- No microphone, camera or location is used.

## What existed before this repo

The Even Realities hackathon build window started on 23 November 2026. Everything in this repository was written on or after that date, from an empty repo.

Before that date, Dan Lab had the idea and product direction of Dani, an AI assistant that prepares work for you to approve. No Dani source code is included or reused here. The sample queue is new synthetic data.

## License

MIT. See `LICENSE`.
