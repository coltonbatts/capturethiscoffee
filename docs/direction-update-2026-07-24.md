# Direction update — 2026-07-24

Paste this to any agent or collaborator picking up Capture This Coffee. It is a
status and direction brief, not a task. The executable brief is
`docs/offline-first-ios-handoff.md`.

## The change

Two decisions were made on 2026-07-24:

1. **Offline-first is now an explicit architectural goal.** This reverses a
   2026-06-01 decision that skipped a durable write queue because set Wi-Fi was
   judged reliable enough. Do not cite that rationale as current.
2. **The Flutter app in `mobile/` becomes the primary surface.** As much of the
   on-set loop as possible moves there.

Neither came from a field failure. They are a direction choice.

## Correct these if you believe them

Older docs and commit history will tell you things that are no longer true:

- ~~"The app consumes the label queue + server PNG API."~~ It renders labels on
  device now. `CtcApi.fetchLabelPng` no longer exists.
- ~~"Runner dashboard is optimistic-only, no durable write queue, deliberately."~~
  Reversed. A durable outbox is planned — in Dart, not in the web app.
- ~~"Offline work belongs in `src/app/run/[id]/`."~~ That board is frozen. New
  capture and offline investment goes in `mobile/`.

## Where the product actually stands

The product is three steps: build the roster → capture each drink → print a
label. The Flutter app owns step three. Steps one and two are still web-only, so
capture and printing happen on different devices.

BLE printing to the NIIMBOT M2_H is proven on real hardware (build 6, holographic
stock, 2026-07-24). Do not destabilize it: do not change the
`niim_blue_flutter: 1.0.1` exact pin, and do not update printer firmware.

## What just landed

Branch `claude/local-label-rendering` (not yet merged).

The app fetched one server-rendered PNG per label at print time, which meant no
signal, no printing — even for orders captured an hour earlier. That was the real
blocker on offline, ahead of any write queue.

- `mobile/lib/label_painter.dart` — port of `grid-01` from
  `src/lib/niimbot-m2-draw.ts`. Keeps the web renderer's Canvas-2D shape on
  purpose so the two files stay diffable.
- `mobile/lib/label_content.dart` — the `CoffeeLabel` fields the renderer reads.
- `clientName` added to the printer-queue payload (the label brand line is
  `production / client`; the queue only sent the production name).
- Arial bundled in `mobile/assets/fonts/` for metric determinism between host
  tests and device.
- `scripts/compare-label-renderers.mjs` stacks server and app output for four
  fixtures. Byte-identity is not the goal and never will be; composition is.

Green: `flutter analyze`, 47 mobile tests, 104 web tests, lint, build,
`verify:niimbot-export`, iOS simulator build.

**Not verified: a physical print from the new renderer.** Do that before a shoot.

## What's next, in order

- **Phase B** — cache the full board (`GET /api/public/productions/[id]`) on disk
  so a cold start with no signal works. Show staleness; a runner acting on a
  two-hour-old roster is a real failure mode.
- **Phase C** — port order capture into Flutter from
  `src/app/run/[id]/runner-board.tsx` and `use-runner-board.ts`. After this, one
  person on one device can capture and print. This is the point of the exercise.
- **Phase D** — generalize `mobile/lib/print_recovery.dart`, which is already a
  durable single-purpose outbox, into a mutation outbox. Do not build a second
  mechanism beside it.

## The simplification worth knowing up front

The public API is **patch-only**. Order rows are created server-side when the
roster is built (`src/server/operator/order-drafts.ts`, seeded from
`person.usual_order`). No public route inserts or deletes.

So the offline layer needs no client-generated IDs, no create/delete sync, and no
tombstones — the three things that make sync hard. It is a map of
`orderId -> coalesced field patch`. If you find yourself building a general sync
engine, you have misread the scope.

## Guardrails

- The web runner board at `src/app/run/[id]/` is **frozen but must keep working**.
  It is the zero-install path for a PA who will never be onboarded to TestFlight.
  That is a real operational advantage Flutter does not replace.
- The web keeps, permanently: people database with photos, roster building, day
  creation, minting share links, auth, and being the database. Typing forty names
  off a call sheet is a keyboard job.
- Do not add write auth beyond the capability share token.
- Do not port the other seven label designs. Only `grid-01` is on the print path.
- Do not delete the server PNG route or renderer — `/labels` uses it and it is
  the comparison baseline.
- Do not delete web code as part of this work. A separate cleanup list exists
  (NIIMBOT CSV export, the vestigial `clients` table, the legacy `OrderStatus`
  enum breadth). It is not part of this direction.

## Two known design bugs

Both are in `drawGrid01` on the web side and are faithfully reproduced by the
Dart port, so fixing them in `src/lib/niimbot-m2-draw.ts` fixes both renderers:

- A two-line drink puts its second baseline at y=292 and the rule sits at y=293,
  so descenders read as a strikethrough.
- A short name at 92px overlaps the `FOR` label above it.

## Where the detail lives

- `docs/offline-first-ios-handoff.md` — the phased executable brief.
- `mobile/README.md` — operating steps, label rendering, print tuning.
- `CLAUDE.md` — repo-wide context. Verify its claims against code; it lags.
