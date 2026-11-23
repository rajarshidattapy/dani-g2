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

Receipts are saved in the Even App's local storage, so an item you already handled does not come back after a restart.

## Demo data is labeled

The repo ships with a small synthetic queue (`public/queue.sample.json`) and a simulated executor so the app runs with no accounts and no paid services. The glasses header says `SAMPLE DATA` the whole time. The simulated executor sends no mail, edits no calendar and shares no file. It also fails the file-share item once on purpose so the retry path can be seen.

All people and items in the sample queue are made up.

## Connect a real assistant

Open the page with `?backend=<url>` (and optionally `&token=<bearer>`). The app then uses:

- `GET {backend}/queue` returning `{ "items": ActionItem[] }`
- `POST {backend}/actions/{id}/approve` returning `{ "ref": "..." }` on success

`ActionItem` is defined in `src/model.ts`. With a backend set, the header says `LIVE` and the simulated executor is not used. Skip and reject are recorded on the device only; the backend is only called on approve.

## Run it

Requires Node 20+.

```bash
npm install
npm test          # unit tests for the state machine, layout limits, event mapping
npm run typecheck
npm run dev       # serves the app on http://127.0.0.1:5173
npm run sim       # second terminal: opens the Even Hub simulator on it
```

On a real G2, serve the app and load its URL from the Even App developer flow, or package it with the Even Hub CLI.

Headless Linux (CI, containers): `scripts/sim-linux.sh` runs the simulator under Xvfb with its automation port on 9898. Then `npm run demo` drives the whole flow and saves one glasses screenshot per step into `demo/steps/`, and `scripts/make-video.sh` turns them into a captioned video (needs ffmpeg and jq).

## How it is built

```
src/model.ts       types: ActionItem, Receipt, QueueSource, Executor
src/store.ts       pure reducer: screen + input -> next screen (no I/O)
src/view.ts        state -> page description (576x288, container limits enforced)
src/glasses.ts     page -> Even Hub SDK containers; SDK events -> app input
src/controller.ts  runs approvals, saves receipts
src/adapters.ts    sample source, HTTP source, HTTP executor, simulated executor
```

The reducer and view have no SDK imports, so they are tested directly. Built with [`@evenrealities/even_hub_sdk`](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) 0.0.16 and tested in [`@evenrealities/evenhub-simulator`](https://www.npmjs.com/package/@evenrealities/evenhub-simulator) 0.9.5.

## Status and limits

- Tested in the simulator only. It has not been run on physical G2 glasses yet.
- The simulator does not emit ring or temple source details, so input handling is by event type only.
- No microphone, camera or location is used.
- The HTTP backend contract above is a proposal. This repo does not include a backend.

## What existed before this repo

The Even Realities hackathon build window started on 23 November 2026. Everything in this repository was written on or after that date, from an empty repo.

Before that date, Dan Lab had the idea and product direction of Dani, an AI assistant that prepares work for you to approve. No Dani source code is included or reused here. The sample queue is new synthetic data.

## License

MIT. See `LICENSE`.
