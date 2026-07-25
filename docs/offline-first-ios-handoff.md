# Offline-first iOS handoff

Written 2026-07-24. This is a task brief for a fresh Claude Code session. Copy the
fenced block below as the opening prompt.

---

````text
You are taking over Capture This Coffee. Read CLAUDE.md and AGENTS.md first, then
docs/offline-first-ios-handoff.md (this file) for the full brief, then verify every
claim below against the actual code before acting. Repo facts drift; this brief was
accurate on 2026-07-24.

## The goal

Move as much of the on-set loop as possible into the Flutter app in `mobile/`, and
make that app work with no network. Offline-first is a deliberate architectural
decision made on 2026-07-24. It REVERSES an earlier (2026-06-01) decision to skip a
durable write queue on the grounds that set Wi-Fi is reliable. Do not resurrect that
argument. The reversal is a direction choice, not a bug report.

## Where things stand

The product is three steps: build the roster → capture each person's drink → print a
label per drink.

The Flutter app owns step three only. `mobile/lib/ctc_api.dart` makes exactly three
calls: GET the label queue, GET a server-rendered label PNG, PATCH `label_printed`.
It cannot create a day, add a person, or capture an order. Steps one and two live in
the Next.js app.

BLE printing to the NIIMBOT M2_H is proven on real hardware (build 6, holographic
stock, 2026-07-24 — see docs/milestones/). Do not destabilize it. In particular do
not change the `niim_blue_flutter: 1.0.1` exact pin in `mobile/pubspec.yaml` (the
comment there explains why), and do not update printer firmware.

## The two facts that shape the whole design

**1. Offline is gated on label rendering, not on the write queue.**

`_printOneLabel` in `mobile/lib/main.dart` calls `CtcApi.fetchLabelPng`, which hits
`/api/public/orders/[id]/label` once per label at print time. So with no signal you
cannot print even orders that were already captured and cached. Porting the renderer
to Dart is the precondition for offline, not an optimization. Do Phase A first.

**2. The public API is patch-only, which makes the outbox far simpler than usual.**

Order rows are created server-side when the roster is built —
`src/server/operator/order-drafts.ts` `toInitialOrderInsert`, seeded by parsing
`person.usual_order`. No public route ever inserts or deletes an order. The app only
ever PATCHes rows that already exist and already have server-assigned IDs.

Therefore the offline layer needs NO client-generated IDs, NO create/delete sync, and
NO tombstones. It is a map of `orderId -> coalesced field patch`. Do not build a
general-purpose sync engine. If you find yourself writing one, you have
misunderstood the scope.

Caveat to verify: `ProductionBoardRosterDTO.order` in `src/server/productions/dto.ts`
is nullable. Confirm whether roster entries can exist with no order row on a live
day. If they can, the app must show those people as un-capturable offline rather than
silently dropping them.

## Phases

Do these in order. Stop and report after each phase — do not run the whole brief in
one pass.

### Phase A — Render labels locally in Dart — DONE 2026-07-24

Landed: `mobile/lib/label_painter.dart` + `mobile/lib/label_content.dart` render
`grid-01` on device; `CtcApi.fetchLabelPng` is gone; `clientName` was added to
the printer-queue payload so the app can build the same brand line. Verified by
`mobile/test/label_render_test.dart`, four goldens, and a stacked visual
comparison against the server renderer for four fixtures.

NOT verified: a physical print from the new renderer. Do that before trusting
this on a shoot.

Original brief follows.

Port the label renderer so the app can print with no network.

- Source of truth: `src/lib/label-copy.ts` (computes title / bodyLines / footer from a
  `CoffeeLabel`) and `src/lib/niimbot-m2-draw.ts` (627 lines, 8 designs).
- Port ONE design: `drawGrid01`, the default. Do not port all eight. The design-picker
  plumbing (`designId` through the queue API, the PNG route, and localStorage) is not
  needed offline.
- A `CoffeeLabel` only needs four real inputs: `personName`, `drink`, `group`,
  `productionClient`. The rest of the type is derived layout.
- Geometry is fixed by `src/lib/niimbot-m2-preset.json`: 591x354 px, 50x30mm at
  300 DPI, printable width 567, safe margin 18. Assert these dimensions in a test.
- The app already depends on `package:image` and feeds `PrintPage.toEncodedImage()`.
  Render via `dart:ui` Canvas, then hand off to the existing print path in `_printPage`
  — do not touch the BLE task logic.
- Font: the server registers Arial from `public/fonts/` in
  `src/lib/niimbot-m2-export-server.ts`. Bundle the same font as a Flutter asset.
- ACCEPTANCE IS NOT PIXEL-IDENTITY. Text metrics differ between `@napi-rs/canvas` and
  Flutter's `TextPainter`; byte-equality is unrealistic and chasing it will waste the
  session. Assert exact output dimensions, then compare visually against
  `npm run verify:niimbot-export` output, and require one physical print on real stock
  before the phase is called done.
- Keep `/api/public/orders/[id]/label` and the server renderer in place. Do not delete
  them in this phase; they stay as the comparison baseline.

### Phase B — Durable local board cache — DONE 2026-07-24

Landed: the app reads `GET /api/public/productions/[id]` and derives its print
queue locally (`PrinterQueue.fromBoard`), `formatDrink` and the capture helpers
are ported to Dart (`mobile/lib/drink_format.dart`), the last good board is
cached in `mobile/lib/board_cache.dart`, and staleness is shown rather than
hidden. Cached data is never treated as server confirmation for print recovery.
Verified by `mobile/test/offline_cold_start_test.dart` (cold start with a
failing API), plus board, drink-format, and cache tests — 93 mobile tests.

NOTHING now calls `GET /api/public/productions/[id]/labels`. The route and its
web tests are still in place, per the do-not-delete-web-code rule.

Two open items carried into Phase D:

- **The complete-production gap.** `readableProductionStatuses` is
  `{planning, active}`, so a production marked complete makes the board 404. The
  app then shows "Working offline" over a roster for a finished day, and the
  cached status still says `active`, so printing is not blocked. Distinguishing
  "cannot reach the server" from "the server says this day is over" needs typed
  errors out of `CtcApi`. Same family as the 403 trap below.
- The staleness threshold (10 minutes) is a guess, not a measured number.

Original brief follows.

- Switch the app from the labels-only queue endpoint to the full board:
  `GET /api/public/productions/[id]?token=...`, which returns `ProductionBoardDTO`
  (see `src/server/productions/dto.ts`). It carries roster, people, and orders.
- Persist the last good board to disk so a cold start with no signal is usable.
- Show a clear "offline — last synced N minutes ago" state. Staleness must be visible;
  a runner acting on a two-hour-old roster is a real failure mode.
- Storage: the capability token stays in Keychain via
  `mobile/lib/session_store.dart` (already correct — do not move it). Cached board
  data is crew names and drinks; app-sandboxed file storage is fine, but it MUST be
  cleared when the production session is unlinked.

### Phase C — Order capture in Flutter

- Port the runner board UI: `src/app/run/[id]/runner-board.tsx` (147 lines) plus the
  components it borrows from `src/app/productions/[id]/components.tsx`. Roster list,
  search, needs-only filter, tap-to-edit, "No drink".
- The editable fields are exactly `runnerOrderFields` in
  `src/lib/production-share.ts`: drink_type, size, temperature, milk_type, sweetener,
  caffeine, special_notes, vendor, status, label_printed. The server rejects anything
  else via `sanitizeRunnerOrderPatch`.
- `src/app/run/[id]/use-runner-board.ts` (189 lines) is the behavioral reference for
  optimistic apply + rollback + reconcile-preserving-pending. Match that behavior in
  Dart; it is well-tested logic worth copying rather than reinventing.
- After this phase one person on one device can capture and print. That is the point
  of the whole exercise.

### Phase D — Generalize the outbox

`mobile/lib/print_recovery.dart` is ALREADY a durable single-purpose outbox — the
`printedNeedsSync` state exists precisely to replay a `label_printed` PATCH that
didn't reach the server. Generalize that existing ledger into a mutation outbox where
print-sync is one entry type. Do NOT build a second parallel mechanism alongside it.

Requirements:

- Coalesce per `orderId`: merge field patches, last local write wins per field. The
  queue stays bounded and replay is one PATCH per order.
- Replay on connectivity return, app resume, and manual sync. `main.dart` already
  observes lifecycle via `WidgetsBindingObserver` and has `_verifyConnectionAfterResume`.
- `label_printed: true` is idempotent; re-sending is safe.
- Preserve the existing invariant in `PrintRecoveryRecord.withState` — a confirmed
  physical print can never be weakened back to uncertain. That rule exists because
  paper came out of a printer and no sync state may contradict physical reality.

Two traps you must handle explicitly, not discover in the field:

- **The 403 trap.** `PATCH /api/public/orders/[id]` returns 403 "Production is not
  active." if `production.status !== 'active'`. If a day is marked complete while
  patches are queued, every replay fails permanently. Surface the stuck queue to the
  operator; never silently drop captured orders.
- **Last-write-wins clobbering.** The PATCH route sets `updated_at` server-side and
  has no version or precondition check. A patch queued twenty minutes ago will
  overwrite newer server values on replay. In practice there is one runner per
  production so this is rare. ACCEPT arrival-order LWW for now and say so in a code
  comment — but do not pretend it is solved. If you want to harden it later the shape
  is an `expected_updated_at` field in the patch envelope and a 409 on mismatch;
  that is a separate task, not this one.

## Explicitly out of scope

- Do not add write auth beyond the capability share token. The app stays token-scoped.
- Do not port all 8 label designs.
- Do not delete the server-side PNG route or renderer.
- Do not rebuild or extend the web runner board at `src/app/run/[id]/`. It is FROZEN
  but must keep working — it is the zero-install path for a PA who will never be
  onboarded to TestFlight. That is a real operational advantage no amount of Flutter
  replaces.
- Do not delete web code in this pass. There is a separate cleanup list (NIIMBOT CSV
  export, the vestigial `clients` table, the legacy `OrderStatus` enum breadth);
  none of it belongs in this task.
- Do not change the printer BLE pipeline, the `niim_blue_flutter` pin, or firmware.

## What stays on the web permanently — SUPERSEDED 2026-07-25

This is no longer the direction. See
[`app-first-direction-2026-07-25.md`](app-first-direction-2026-07-25.md): the web
is frozen, and the app takes over people, rosters, day creation, and auth by
talking to Postgres directly through Supabase Auth. The ergonomic argument below
(forty names is a keyboard job) was accepted as a real cost, not refuted.

The rest of this brief still stands — including the warning against building a
general-purpose sync engine. The direction doc adds the boundary that keeps that
warning satisfiable: creation online, capture and printing offline.

Original text follows.

People database with photos, roster building, day creation, minting share links,
auth, and being the database. Typing forty names off a call sheet is a keyboard job.
The web is not going away; its runner and label-export halves are.

## Testing

- `mobile/test/` already has the right patterns: `ctc_api_test.dart` and
  `print_recovery_test.dart`, with `MemorySessionRepository` and
  `MemoryPrintRecoveryRepository` as in-memory fakes. New outbox tests follow that
  idiom.
- Add a real airplane-mode manual script: link a production online, go offline, cold
  start, capture three orders, print two, come back online, verify all five states
  land server-side exactly once.
- Web side must stay green: `npm run test`, `npm run lint`, `npm run build`.

## Report back

Files changed, behavior changed, tests run with actual results, anything you could not
verify (especially physical printing and Supabase state), and any pre-existing git
changes you left alone.
````
