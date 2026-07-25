# iOS complete-product plan

Last updated: 2026-07-25

## Decision

The Capture This iOS app in `mobile/` becomes the only primary product surface.
The Next.js app stays deployed, tested, and frozen as an operational fallback.

This plan succeeds
[`app-first-direction-2026-07-25.md`](app-first-direction-2026-07-25.md) and
starts from the completed Build 8 UI rework in
[`ui-rework-build-8.md`](ui-rework-build-8.md).

The product handed to the client should have one normal instruction:

> Open Capture This.

No production URL is required for normal app use. A signed-in operator selects
or creates a day, prepares its people, collects orders, prints labels, shares
the shop summary, and closes the day without moving to the website.

## Baseline

Verified on 2026-07-25 at commit `7ed6f04`:

- The iOS app is `1.0.0+8`.
- Flutter analyzer is clean and all 124 Flutter tests pass.
- All 104 web tests pass.
- Build 8 has a home screen, print deck, printable roster, recovery screen,
  on-device `grid-01` label rendering, durable board cache, and durable
  print-recovery evidence.
- The app still authenticates with a production share URL and calls only the
  token-scoped Next.js board and order PATCH routes.
- The app cannot yet sign in, list or create days, manage people or rosters,
  capture orders, produce the coffee-shop summary, or close a day.
- Build 8's real-iPhone/M2_H checks remain open and must be completed before
  its print path is treated as the regression baseline.

## Definition of done

The app is the complete product when all of these are true:

1. An owner-provisioned user can sign in and recover a session without a
   production link.
2. The user can list, create, edit, activate, complete, and switch shoot days.
3. The user can create and edit people, take or choose a photo, manage usual
   orders, and archive people.
4. The user can build a day roster from existing people, quick-add a person,
   bulk-paste a call-sheet list, edit groups/on-set state, order the roster, and
   remove someone.
5. The user can collect and edit drinks, accept a usual order, mark no drink,
   and optionally update the person's usual order.
6. Order capture and label printing work through a cold start with no signal,
   and queued writes reconcile visibly when signal returns.
7. The user can connect the M2_H, print one or many labels, reprint
   intentionally, and resolve an interrupted print without producing an
   accidental duplicate.
8. The user can view, copy, and share the coffee-shop summary, see capture and
   print completion, and close the day.
9. The app can create and share a scoped runner link when the zero-install web
   fallback is needed.
10. Normal iOS operation makes no request to `src/app/api/public/*`. The
    normal runtime dependency is Supabase, not the Next.js deployment.
11. The frozen web deployment still passes test/lint/build and retains
    `/run/[id]`, `/labels`, `/privacy`, and `/support` as fallbacks.
12. A receiving operator completes the entire workflow on the final iPhone,
    M2_H, firmware, ribbon, and stock without the outgoing owner touching the
    phone or web dashboard.

## Product boundary

The rule that keeps this achievable is:

> **Creation online. Capture and printing offline.**

Creating days, people, photos, rosters, and links may require a connection.
Those actions should be visibly disabled while offline and must never pretend
to have succeeded locally.

Once a day has been loaded, collecting drinks and printing labels must continue
offline. This is the narrow, high-value offline path. It does not require
offline person creation, offline day creation, tombstones, or a
general-purpose local database sync engine.

## Target app map

| Surface | Primary job |
|---|---|
| **Sign in** | Owner-provisioned email/password access; no public signup |
| **Days** | Pick today, see status/progress, create a day, switch days |
| **Day home** | One operational overview: Collect, Print, Roster, Summary, sync, printer |
| **Collect** | Search/filter people, accept usuals, edit drinks, mark no drink |
| **Print** | The proven Build 8 deck, batch print, intentional reprint |
| **Roster** | Add existing people, quick add, bulk paste, edit group/on-set/order |
| **People** | Search, create/edit/archive, photo, usual order, notes |
| **Summary** | Grouped shop order, by-person view, copy/share, capture/print counts |
| **Recovery** | The one place for uncertain physical prints and stuck mutations |
| **Day settings** | Edit details/status, create fallback runner link, complete/delete |
| **About/help** | Version, privacy, support, licenses, day-of procedure |

Build 8's home screen becomes **Day home**. When no day is selected, the root
surface is **Days**, not the production-link field.

## Architecture

### Identity and configuration

- Add `supabase_flutter` using the same project URL and anon key as the web.
- Supply public configuration through reviewed release configuration; never
  bundle the service-role key.
- Use Supabase Auth's persisted session and refresh behavior. A temporary
  network failure must not sign the operator out or erase the cached day.
- Keep public signup disabled. V1 is one invited workspace: every invited
  account has the same full operator access the web currently grants.
- Do not add multi-tenancy or a role matrix as part of this migration. Revisit
  that before inviting users who should not see the whole workspace.

### Data access

Do not let Supabase calls spread through widgets or through the existing
1,200-line printer controller.

- Introduce typed repositories for auth, days, people, rosters, orders,
  storage, and share links.
- Keep widgets dependent on repository interfaces so tests use in-memory
  fakes.
- Port the web's input normalization and length limits to Dart.
- Use direct RLS-protected CRUD for single-row operations.
- Add transactional Postgres functions, through `supabase/migrations/`, for
  operations that must create several rows together:
  - create a production plus its default roster and order rows;
  - add an existing person to a roster plus their order row;
  - create a person, optionally link them to the client, add them to the
    roster, and create their order row.
- Continue using `create_production_share_token(...)` for fallback links.
- Keep the service-role key exclusive to the frozen Next.js fallback routes.

### State ownership

Build 8 correctly removed UI and navigation from the printer controller. The
complete app should continue that separation:

- **Session controller:** auth state and sign-in/sign-out.
- **Workspace controller:** days, selected day, people, online-only setup
  mutations.
- **Board controller:** selected day board, optimistic order capture, cache,
  Realtime refresh, mutation replay, and sync status.
- **Printer controller:** BLE connection, print queue execution, physical
  outcome, haptics, and print recovery.

Keep ChangeNotifier/InheritedNotifier unless the real implementation shows a
clear need for a state-management dependency. Do not turn one controller into
another monolith.

### Authoritative board

- Build the signed-in production board directly from `productions`,
  `clients`, `production_roster`, `people`, and `orders`.
- Keep one shared Dart board model feeding Collect, Print, Roster, Summary, and
  the home progress cards. Do not create a second printer-only truth.
- Cache boards by authenticated user ID and production ID.
- A Realtime event is a refresh signal; pull and reconcile an authoritative
  snapshot rather than hand-applying every joined-table event.
- Keep a periodic/manual refresh fallback.

### Offline mutations and conflicts

Generalize `print_recovery.dart`; do not create a second durable outbox next to
it.

- Coalesce order field changes per `orderId`; the latest local value wins per
  field.
- Store the server `updated_at` observed before the first queued edit.
- Replay on connectivity return, app resume, manual sync, and successful
  sign-in refresh.
- Apply ordinary drink patches conditionally against that observed
  `updated_at`. If the row changed elsewhere, stop and show a conflict instead
  of silently overwriting newer data.
- Treat `label_printed: true` as an idempotent physical fact. A confirmed
  physical print may never be weakened or discarded because another field
  conflicted.
- Preserve the existing uncertain-print decision separately: the operator
  still has to inspect the physical output before choosing sync-only or retry.
- If a production is completed while mutations remain, surface a blocked
  queue and provide a deliberate reopen/sync/complete decision. Never drop it.

### Photos

- Use the private `person-photos` Supabase Storage bucket with the signed-in
  session.
- Support camera and photo-library selection, crop/compress before upload, and
  enforce the existing size and content-type rules.
- Persist the same stable storage reference shape the frozen web already
  understands; never persist an expiring signed URL. Generate signed display
  URLs as needed.
- Photos are helpful during setup/capture but must not block an offline roster
  from rendering; initials remain the fallback.

### Frozen web

The web is frozen, not removed:

- No new product surface in `src/`.
- Keep `/run/[id]` as the zero-install fallback.
- Keep `/labels` as the advanced emergency export until the iOS fallback has
  passed a real incident drill.
- Keep `/privacy` and `/support` live for App Store requirements.
- Keep Vercel and the public API routes deployed while fallback share links
  exist.
- Every database migration must be checked against the frozen web app.
- Continue running `npm run test`, `npm run lint`, and `npm run build`.

## Release sequence

Each build is independently usable and ends with a TestFlight acceptance pass.
Do not save validation for the final build.

### Before Build 9 — establish the Build 8 physical baseline

Complete the six open checks in `ui-rework-build-8.md`:

1. Single label compared physically with Build 7.
2. Batch interruption and recovery after relaunch.
3. Haptics.
4. Press/entrance motion on a real screen.
5. Completed-production refusal.
6. Reduce Motion end to end.

Record the exact Build 8 source and results. The print pipeline then becomes a
protected subsystem for every later build.

### Build 9 — sign in and choose a day

Goal: replace the pasted link as the normal front door without disturbing
printing.

- Add Supabase initialization and owner-provisioned email/password sign-in.
- Restore and refresh sessions; add sign-out.
- Add Days with active/upcoming/recent grouping and capture/print progress.
- Select a day and load its signed-in board directly from Supabase.
- Feed the selected board into the existing home, roster, deck, and recovery
  screens.
- Cache the selected day and board for an offline cold start.
- Keep the current share-link path available under a temporary **Legacy link**
  entry for one migration build.

Acceptance:

- Fresh install → sign in → select an active day → connect → print.
- Relaunch restores the account and selected day.
- Airplane-mode relaunch opens the cached selected day and still prints.
- Invalid/expired auth never erases unresolved print evidence.
- The legacy link path still behaves exactly as Build 8.

### Build 10 — create the day and prepare the roster

Goal: all pre-production setup moves to iOS.

- Create/edit/delete day, client/brand, date, location, runner, notes, status.
- People list with search, create/edit/archive, usual order, dietary/private
  notes, camera/library photo.
- Roster builder: add existing, quick add, group, on-set toggle, remove,
  reorder.
- Add bulk paste with a preview/deduplication step for newline/comma-separated
  call-sheet names. This is required to make a forty-person phone workflow
  credible.
- Use transactional database functions for multi-row roster/order creation.
- Clearly require a connection for every creation/deletion operation.

Acceptance:

- Starting only with an invited login, build a fictional 40-person day on an
  iPhone without visiting the website.
- No partial roster member can exist without its order row.
- Duplicate people and duplicate roster rows are caught before write.
- Photo upload, signed display, initials fallback, and archive behavior pass.
- Going offline during setup yields an honest retryable failure, not a fake
  local success.

### Build 11 — collect orders offline

Goal: one person with one phone can collect and print the entire day.

- Add Collect as a first-class destination and home action.
- Port the web order editor fields and vocabulary exactly.
- Add accept-usual, edit, no-drink, and update-usual-order actions.
- Apply optimistic changes immediately.
- Generalize print recovery into the durable coalescing mutation outbox.
- Reconcile incoming snapshots while preserving pending local edits.
- Add explicit conflict and completed-day/stuck-queue handling.
- Add Realtime-triggered refresh plus the existing polling/manual fallback.

Acceptance:

- Load the day online, enter airplane mode, cold start, capture at least three
  orders, print at least two, restore signal, and verify every field plus both
  printed facts reach Supabase exactly once.
- Kill/relaunch with pending edits; the queue survives and replays.
- Edit the same order from the fallback web board; the app detects the
  conflict and never silently clobbers it.
- Completing a day with pending writes cannot silently strand or delete them.
- Capture and print progress agree on every screen.

### Build 12 — complete the operating loop

Goal: there is no normal reason to open the operator website.

- Add grouped-by-drink and by-person summaries from the shared Dart formatter.
- Copy/share the shop order through the iOS share sheet.
- Add day closeout with capture/print/pending-sync checks.
- Mint, copy, and share a scoped `/run/[id]?token=...` fallback link from the
  app.
- Add local single/batch `grid-01` PNG sharing as the first iOS fallback when
  BLE printing is unavailable.
- Keep the advanced web `/labels` route as the final emergency fallback; do
  not port the seven unused label designs.
- Remove the production-link field from the normal root flow. If retained for
  one more release, place it behind Help/Advanced and label it legacy.
- Rewrite in-app help around the new sign-in → day → collect → print → summary
  sequence.

Acceptance:

- A new operator completes setup through closeout without opening Safari.
- The shared summary matches the frozen web formatter for the same fixtures.
- A fallback runner receives a newly minted link and can update only that day.
- Local exported PNGs match the actual print renderer and open through the iOS
  share sheet.
- A day cannot be closed accidentally with unresolved physical prints or
  unsynced mutations.

### Build 13 — client handoff release candidate

Goal: prove the product can leave the builder's hands.

- Remove or explicitly archive stale web-first instructions across the handoff
  packet.
- Update App Store screenshots, description, privacy answers, support copy,
  and review fixture for the complete app.
- Run analyzer, all Flutter tests, all web checks, signed archive inspection,
  and migration/RLS verification.
- Run the full physical test on the final iPhone/M2_H/firmware/ribbon/stock.
- Run a dead-zone/airplane-mode drill and a fallback web drill.
- Have the receiving operator independently perform install → sign in → create
  day → build roster → collect → print → recover → summarize → close.
- Finish unlisted App Store distribution, owner access, billing/renewals,
  backup owner, support boundary, stock reorder source, and replacement-build
  path.

Acceptance:

- The receiving operator needs no production link and no operator website for
  the normal workflow.
- The web fallback is still live and documented, but is not part of the happy
  path.
- All access, hardware, recurring obligations, and recovery procedures have a
  named client-side owner.

## Capability migration checklist

| Capability | Build 8 | Target build |
|---|---:|---:|
| Home/navigation/design system | Done | Preserve |
| Direct M2_H printing | Done; physical Build 8 gate open | Pre-Build 9 |
| Local label rendering | Done | Preserve |
| Cached offline board | Done, one token-linked day | Build 9 multi-day/auth scope |
| Print recovery | Done | Build 11 generalized outbox |
| Sign in/session | Missing | Build 9 |
| Days list/select | Missing | Build 9 |
| Create/edit/complete day | Web only | Build 10/12 |
| People/photos/usuals | Web only | Build 10 |
| Roster build/bulk add | Web only | Build 10 |
| Order capture | Web only | Build 11 |
| Offline capture replay | Missing | Build 11 |
| Realtime reconciliation | Missing | Build 11 |
| Coffee-shop summary/share | Web only | Build 12 |
| Create fallback runner link | Web only | Build 12 |
| Local PNG fallback | Web only | Build 12 |
| Client-independent handoff | Incomplete | Build 13 |

## Verification required on every build

Automated:

```bash
cd mobile
flutter analyze
flutter test
```

```bash
npm run test
npm run lint
npm run build
```

Also keep the four label goldens unchanged and visually compare server/app
renderers when label-related dependencies move:

```bash
npx tsx scripts/compare-label-renderers.mjs
```

Manual, proportional to the build:

- Real iPhone, not only simulator.
- Real accepted M2_H and stock for every release candidate.
- Cold start online and offline.
- Background/resume and session refresh.
- Single print, batch print, intentional reprint, interrupted print.
- Two-device sync when order or roster behavior changes.
- VoiceOver, Dynamic Type, Reduce Motion, keyboard/focus, and large roster.
- Sanitized fictional data only in screenshots, logs, and review fixtures.

## Explicit non-goals

- Do not delete the web app.
- Do not make day/person/roster creation offline.
- Do not build a general-purpose bidirectional local database.
- Do not port the other seven experimental label designs.
- Do not update `niim_blue_flutter: 1.0.1`.
- Do not update NIIMBOT firmware.
- Do not rebuild a laptop print station.
- Do not add public signup.
- Do not add multi-tenancy or complex roles during this migration.
- Do not treat passing automated tests as the physical printer release gate.

## First implementation slice

The first code task after Build 8's physical baseline is:

1. Introduce Supabase configuration, auth repository, and test fakes.
2. Add the signed-out and session-restoring root states.
3. Add a read-only Days screen.
4. Select an existing day and adapt its direct Supabase rows into the exact
   `ProductionBoard` Build 8 already consumes.
5. Prove the current deck prints from that board without any
   `/api/public/*` request.

Stop there, test it on the phone and M2_H, and only then add write operations.
