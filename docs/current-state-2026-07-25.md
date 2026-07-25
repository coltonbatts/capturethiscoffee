# Capture This current state — Build 9 boundary

Last updated: 2026-07-25

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
- App version: `1.0.0 (9)` / bundle `com.capturethis.ctcprinter`.
- Build 9 was uploaded and processed in App Store Connect on 2026-07-25 and is
  assigned to the internal `Main` TestFlight group.
- The account owner installed a signed Build 9 release, opened an authenticated
  day, and completed one physical M2_H reprint.
- Build 9 is consumed. Any shipping-code or embedded-metadata change must use
  build 10 or later.

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

## Build 9 exit gate

Do not begin Build 10 shipping work until the following Build 9 checks are
recorded:

1. Online sign-in and selected-day restoration after force-quit.
2. Airplane-mode cold start from an authenticated cached day.
3. Ten-label batch on the accepted M2_H and stock.
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

Older web-first strategy and operating documents are historical unless their
opening status note says they have been reconciled with this boundary.
