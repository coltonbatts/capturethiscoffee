# Capture This current state — Build 10 implementation

Last updated: 2026-07-27

## Executive decision

The iOS app in `mobile/` is the product. The Next.js app remains deployed,
tested, and frozen as a fallback. Frozen means no new web product features, but
security, compatibility, privacy, support, and fallback-reliability maintenance
remain required.

The normal target workflow is:

> Open Capture This → choose or create a day → prepare people → collect drinks
> → print labels → share the shop summary → close the day.

The zero-install `/run/[id]` runner board and authenticated `/labels` export
remain available when the app or printer path is unavailable.

## Source and release boundary

- Build 9 source snapshot: `47c4405` (`Ship Build 9 signed-in day selection`).
- Current TestFlight app version: `1.0.0 (10)` / bundle
  `com.capturethis.ctcprinter`.
- Build 9 was uploaded and processed in App Store Connect on 2026-07-25 and is
  assigned to the internal `Main` TestFlight group.
- The account owner installed a signed Build 9 release, opened an authenticated
  day, and completed one physical M2_H reprint.
- Build 9 is consumed. Any shipping-code or embedded-metadata change must use
  build 10 or later.
- Build 10 implementation started from clean `main` at `6e54cc5` and is
  committed and pushed at `fea2fc3` (`Ship Build 10 offline collection and
  sync`). A clean production-configured archive was created from `ab5edb8`,
  signed and exported as `1.0.0 (10)`, uploaded at 4:24 PM CDT on 2026-07-27,
  and reported available to the existing internal TestFlight tester at
  4:26 PM CDT.
- Build 10 architecture, vertical slices, acceptance tests, and release
  blockers are recorded in
  `docs/build-10-implementation-2026-07-25.md`.
- The exact physical-gate audit, disposable-project preflight, shortest
  practical operator session, and live evidence worksheet are in
  `docs/build-10-release-validation-2026-07-25.md`.
- On 2026-07-27, the Build 10 migrations were first verified in the explicitly
  authorized disposable remote project `svqxznvyrbmbqihekkwo`. Ledger, schema,
  RLS, Realtime publication, anonymous refusal, authenticated conditional
  writes/conflicts, monotonic printed facts, and filtered Realtime all passed.
  The transient verifier rows were removed and a cleanup audit found zero.
  The owner later applied both migrations by hand in production. The monotonic
  printed-fact trigger is verified enabled; production Realtime publication
  membership remains unverified, with polling/resume/manual fallbacks retained.
- Guarded public-key/user-session tooling seeded persistent fictional fixture
  `build10-20260727-a`: initially exactly 10 Build 9 batch labels, 12 recovery
  labels, 24 uncaptured Build 10 orders, one Planning order, and one Complete
  order. Both disposable accounts can read it. After the first batch attempt
  stopped without paper, Operator 01 was safely retried and one fresh fictional
  replacement person/order was added through Account A's public RLS session.
  The fixture now has 25 people and 49 orders, including exactly ten fresh
  unprinted labels on the Build 9 batch day.
- After the final fixture-tool change, Flutter analysis and 158/158 tests plus
  frozen-web 105/105 tests, warning-free lint, production build, and NIIMBOT
  geometry all passed again before 12:20 CDT.
- The preserved Build 9 IPA embeds the production Supabase host. It must remain
  provenance evidence only during acceptance. The ten Build 9 physical checks
  require an exact detached `47c4405` release-mode device run configured with
  the disposable public URL/key; this creates no archive or upload. That clean
  detached source passed analysis plus 140/140 tests and is installed directly
  in isolated bundle `com.capturethis.ctcprinter.build10validation`; its signed
  app contains the disposable hostname and no production hostname.
- Physical Build 9 checks 1, 2, 5, 6, and 9 have passed on the iPhone.
- **Check 3, the unattended ten-label batch, has FAILED.** Two `Print all` runs
  stopped on the batch's own first label: Operator 01 timed out awaiting
  `0x04 inPageStart` with no paper, and Operator 02 timed out awaiting
  `0xe4 inPageEnd` after one label emerged. The app's stop, durable-uncertainty,
  BLE teardown, and refusal to advance were all correct; the printer's
  acknowledgement is what did not arrive. Root cause was not isolated — firmware,
  ribbon/stock lot, BLE conditions, and the 10 s acknowledgement window all
  remain uneliminated. On 2026-07-27 the owner accepted **single-label printing
  as the supported operating mode** and recorded unattended batch printing as a
  documented product limitation. No shipping code, printer-library pin, firmware,
  geometry, or density was changed.
- Checks 4, 7, 8, and 10 remain open.

## What Build 9 can do

- Initialize from reviewed public Supabase configuration.
- Sign in with an owner-provisioned email/password and restore the session from
  the iOS Keychain.
- List active, planning, and complete days with capture/print progress.
- Select and restore an existing day.
- Read the selected board directly from RLS-protected Supabase tables.
- Cache the selected day and board by authenticated user and production.
- Cold-start from the cached board without a signal.
- Render `grid-01` labels on device.
- Connect to the accepted NIIMBOT M2_H and print one or many captured labels.
- Persist uncertain or printed-needs-sync evidence across relaunches.
- Synchronize `label_printed` directly to Supabase when signed in.
- Fall back to the Build 8 share-token workflow through **Legacy link**.

Normal signed-in operation does not call `src/app/api/public/*`. Those routes
remain for the zero-install runner and legacy-link fallback.

## What Build 9 cannot do

- Capture or edit a drink.
- Mark a person no-drink or accept/update their usual order.
- Queue and replay offline order mutations.
- Detect and resolve order conflicts with another device.
- Create or edit a day.
- Create, edit, archive, photograph, or search the full people database.
- Add, remove, bulk-paste, group, or reorder a roster.
- Build and share the coffee-shop summary.
- Mint a fallback runner link from the app.
- Close a day with capture, print, and pending-sync guards.
- Share local label PNGs when BLE printing is unavailable.

The current iOS **Roster** is a printable-label roster. People who still need an
order are present in the cached board model but do not yet have an operating
surface.

## Build 10 physical acceptance — still open after TestFlight upload

The owner explicitly authorized the internal TestFlight upload to obtain Build
10 device time. That upload does not close the following physical checks:

1. Online sign-in and selected-day restoration after force-quit.
2. Airplane-mode cold start from an authenticated cached day.
3. Ten-label batch on the accepted M2_H and stock. **Failed 2026-07-27; closed
   with an owner-accepted limitation rather than a pass.**
4. Bluetooth interruption, relaunch, and correct uncertain-print resolution.
5. Printed-but-unsynced recovery through **Sync only** without a duplicate.
6. Sign-out and second-account cache isolation.
7. Planning/complete-day print refusal.
8. Haptics and Reduce Motion on a physical iPhone.
9. Cold-cup adhesion and readability.
10. Independent operator run without the builder touching the phone.

Automated checks are necessary but do not replace this gate.

## Build 10 — close the on-set loop

Build 10 is order collection on an existing day, not full setup migration.
This is the shortest route to the core promise:

> Select a day → take a coffee order → print its label → keep working without a
> signal → synchronize later.

Required scope:

- First-class **Collect** destination using the complete board roster.
- Needs-order, captured, and no-drink states.
- Accept usual, edit drink, no-drink, and optional update-usual actions.
- Optimistic board updates.
- Durable, coalescing order-mutation outbox keyed by order ID.
- Conditional replay against the server `updated_at` observed before the first
  local edit.
- Explicit conflicts; never silently overwrite another device.
- Realtime as a refresh signal, with polling and manual refresh retained.
- One board truth feeding Collect, Print, progress, and later Summary.
- Preserve `label_printed: true` as an idempotent physical fact even when an
  ordinary order-field conflict exists.

Acceptance:

1. Load a day online.
2. Enter airplane mode and cold-start.
3. Capture at least three orders and print at least two labels.
4. Kill and relaunch with pending mutations.
5. Restore signal.
6. Verify every order field and both printed facts reach Supabase exactly once.
7. Create a competing web edit and verify the app stops on a visible conflict.

The local Build 10 implementation now covers this workflow in app/controller
tests, including three offline captures, two durable print facts, relaunch,
single replay, and a competing-edit conflict. A clean disposable local Supabase
stack also verifies authenticated RLS, conditional stale-write refusal,
irreversible printed facts, and the filtered Realtime signal. On 2026-07-27,
the owner explicitly authorized disposable remote project
`capture-this-build10-disposable` (`svqxznvyrbmbqihekkwo`). The pre-Build-10
schema, orders-Realtime migration, and Build 10 printed-fact migration were
applied there after an exact dry-run. Migration history, a second dry-run,
remote schema dumps, publication membership, and anonymous RLS refusal passed.
Authenticated fictional-fixture verification has passed. The remaining
physical device checks are still required; automated fakes and database checks
are not physical release evidence.

## Later builds

### Build 11 — prepare the day

- Day create/edit/activate/delete.
- People create/edit/archive, usuals, notes, and photos.
- Roster add/remove/reorder/group/on-set state.
- Bulk call-sheet paste with preview and deduplication.
- Transactional Postgres functions for multi-row day/roster/order creation.
- Creation remains online-only and must fail honestly while offline.

### Build 12 — complete the operating loop

- Grouped and by-person coffee-shop summaries.
- Native copy/share.
- Day closeout with capture/print/pending-sync guards.
- Fallback runner-link mint/copy/share.
- Local `grid-01` PNG sharing.
- Remove Legacy link from the normal root flow.

### Build 13 — client handoff release candidate

- Final physical and dead-zone drills.
- Independent install-to-closeout operator run.
- Current App Store screenshots, privacy answers, support copy, and review
  fixture.
- External pilot and permanent unlisted App Store distribution.
- Named owners for accounts, billing, backups, support, stock, and replacement
  builds.

## Architecture guardrails

- Creation online; capture and printing offline.
- Do not build a general-purpose bidirectional local database.
- Keep auth/session, board/outbox, workspace/setup, and printer concerns
  separate.
- Keep one shared `ProductionBoard` truth.
- Use RLS-protected direct Supabase access for signed-in operation.
- Add transactional Postgres functions before multi-row setup writes.
- Keep public signup disabled. V1 remains one invited workspace with full access
  for every invited account.
- Do not change `niim_blue_flutter: 1.0.1` or update printer firmware.
- Do not delete the frozen web fallback.

## Active source-of-truth documents

Read these in order:

1. `docs/current-state-2026-07-25.md` — current status and next build.
2. `docs/app-first-direction-2026-07-25.md` — product decision and boundaries.
3. `docs/ios-complete-product-plan-2026-07-25.md` — complete build sequence.
4. `mobile/README.md` — current app architecture and operating details.
5. `docs/release-evidence-1.0.0.md` — verified artifact and release evidence.
6. `docs/testflight-checklist.md` — physical/internal/external pilot gates.
7. `docs/build-10-implementation-2026-07-25.md` — Build 10 architecture,
   decisions, vertical slices, and implementation evidence.
8. `docs/build-10-release-validation-2026-07-25.md` — exact remaining gate
   status, physical session order, disposable-project acceptance, and evidence
   record.

Older web-first strategy and operating documents are historical unless their
opening status note says they have been reconciled with this boundary.
