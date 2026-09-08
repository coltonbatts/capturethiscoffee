# Capture This — NIIMBOT M2_H BLE (iPhone)

Native iOS app that renders cup labels on device and prints directly to the
supported NIIMBOT M2_H over Bluetooth LE. Signed-in operators use Supabase for
online setup and durable offline capture/print synchronization. **Legacy link**
retains token-scoped access as a fallback.

Start with [AGENTS.md](../AGENTS.md). This guide describes architecture and
operating constraints; use the [documentation index](../docs/README.md#status-and-evidence)
and the [delivery checklist](../docs/delivery-status.md) for current findings.
Source capabilities do not prove
that a build is deployed, installed, Apple-approved, or physically accepted.
For UI work, consult the focused [subsystem rules](../docs/subsystem-constraints.md#mobile-interface-and-labels).

The in-app help screen contains the condensed day-of workflow and duplicate-safe
recovery rules. The complete role-based handoff packet starts at
[`docs/HANDOFF.md`](../docs/HANDOFF.md).

The app is the primary on-set surface. The web remains the authenticated
operator/admin and fallback surface, including template drafting, publishing,
default selection, Planning-day assignment, links, the zero-install runner, and
PNG/CSV export. See the
[Build 13 launch record](../docs/build-13-app-store-launch-2026-07-30.md).

## Primary on-set workflow

1. Open **Capture This** and sign in with an owner-provisioned email/password.
   There is no public signup.
2. Choose an existing Active day on **Days**. Planning and Complete days remain
   visible, but physical printing is paused unless the selected day is Active.
   The day uses its validated, immutable template snapshot; a legacy day
   without one uses bundled Grid 01.
3. Open **Collect**. Accept a usual, take or edit an order, mark no-drink, and
   optionally save the result as that person's usual. Local edits appear in
   Collect and Print immediately and survive an offline relaunch.
4. **Connect printer** (force-quit the official NIIMBOT app first).
5. Work the **deck**: it shows the next label at real size with one action —
   **Print this label**. The app renders on device, prints, then marks
   `label_printed` through authenticated Supabase RLS. Inspect that label and
   its recovery or synchronization state before starting the next one.
6. To print someone out of order, find them in the **roster** below the deck and
   tap the print icon on their row.
7. Open **Summary & closeout** to reconcile grouped drink quantities and every
   on-set person's Waiting, Captured waiting to print, Printed, or No drink
   state. Share the summary if needed.
8. Complete the day only online and only after all waiting,
   captured-but-unprinted, pending-sync, conflict, and uncertain-print states
   are resolved. The server validates and permanently closes the day; the app
   does not optimistically mark a rejected closeout complete.

For token-based fallback access, choose **Legacy link** from
Sign in, Days, or the setup screen and paste the runner share URL. That path is
the maintained public Next.js APIs.

## Native setup workflow

1. From **Days**, create a Planning day or open the setup control on an existing
   day. Setup changes require a live authenticated connection.
2. Find existing people or quick-create them with role, department, company,
   usual order, private dietary notes, general notes, and an optional camera or
   photo-library image. Person photos remain in the private `person-photos`
   bucket and are displayed with short-lived signed URLs.
3. Add people individually, or paste newline/comma-separated names into **Bulk
   roster**. The preview collapses whitespace and resolves duplicate, archived,
   existing, and already-rostered names before the atomic write becomes
   available.
4. Drag to reorder, edit a group, toggle on-set state, or remove a roster entry.
   Every accepted member has exactly one matching initial order.
5. Choose **Continue to Collect**. That selection opens Collect directly with the same
   `ProductionBoard` used by Collect, Print, progress, offline cache, conflicts,
   and recovery. Setup has no local mutation outbox.

## Core journey and simulator review

Collect, Print, and Summary have direct sibling navigation; Back returns to the
day overview. At larger text sizes, a full-width **Go to** selector replaces the
three narrow destinations. The navigation hides above an open keyboard.
Collect builds rows lazily and expands one action area at a time; conflict review
stays visible. Printed, captured, needs-order, and no-drink states remain distinct.
People search and results scroll together so the keyboard cannot trap the list.

For local fictional review only, run `flutter run --no-pub -t tool/simulator_review.dart`
on an iOS Simulator. This explicit debug entrypoint uses memory repositories and
is not imported by the production entrypoint. It binds loopback port 8877; request
`http://127.0.0.1:8877/collect` (or `sign-in`, `days`, `setup`, `roster-setup`,
`people`, `people-empty`, `home`, `print`, `recovery`, `conflict`, `summary`) to reset
and open a scenario. All edits are temporary. Offline/recovery scenarios are
injected states, not radio or physical-print evidence. Stop the Flutter run when
finished. The current delivery checklist links the local before/after evidence.

## Screen structure

Sign in and Days precede the selected-day surfaces. Root state is coordinated
by separate session, workspace, and printer controllers.

| Surface | Route | What it is |
|---|---|---|
| **Sign in** (`lib/screens/sign_in_screen.dart`) | root state | Owner-provisioned email/password only; no signup. |
| **Days** (`lib/screens/days_screen.dart`) | root or `/days` | Active, planning, and complete days with capture/print progress. Selects and restores a day. |
| **Day setup** (`lib/screens/day_editor_screen.dart`) | pushed from Days/setup roster | Online-only create/edit/status and server-enforced Planning-only deletion. |
| **People** (`lib/screens/people_screen.dart`) | `/people` | Dense search, create/edit/archive, usuals, notes, and private photos. |
| **Setup roster** (`lib/screens/setup_roster_screen.dart`) | pushed from Days/Home | Find/quick-create, bulk review, groups, on-set state, remove, and atomic reorder. |
| **Home** (`lib/screens/home_screen.dart`) | — | Where you land and return to. The mark, the day, and one entry per destination, each carrying its own state. |
| **Collect** (`lib/screens/collect_screen.dart`) | `/collect` | Complete on-set roster with needs-order, captured, no-drink, pending-sync, setup-needed, and conflict states. |
| **Deck** (`lib/screens/print_screen.dart`) | `/print` | Production name, sync age, labels-left, the next label, and one action. |
| **Roster** (`lib/screens/roster_screen.dart`) | `/roster` | Search, To print / Printed / All with counts, dense rows that expand in place. |
| **Unresolved** (`lib/screens/recovery_screen.dart`) | `/recovery` | The only place a print outcome can be resolved. |
| **Summary & closeout** (`lib/screens/summary_screen.dart`) | `/summary` | Grouped shop quantities, per-person state, native iOS sharing, closeout blockers, and server-confirmed permanent completion. |
| **About** (`lib/screens/about_screen.dart`) | `/about` | Version, privacy, support, licenses. |
| **Legacy link** (`lib/screens/link_screen.dart`) | root state | Token-based fallback. Paste a share link; validation answers under the field. |

The deck answers "can I print right now?" in its own button rather than making
the operator assemble that from separate status cards. Blocking reasons are
ordered by fixability: disconnected → day closed → production not active →
recovery pending.

**Home does not weaken that.** Putting a screen in front of the deck risks
undoing the thing the deck exists for, so its print entry renders the same
`DeckBlock` — the count, the next person, and the blocking reason — and is
yellow only when a print would actually succeed. A blocking reason routes to the
screen that can clear it, not back to the deck to be repeated.

`lib/widgets/label_preview.dart` calls the same `renderLabelImage` the print
path uses, so the preview cannot drift from the paper. When it cannot render, it
says so: `renderLabelPng` wraps that same function, so a failed preview is a
print about to fail.

Design tokens live in `lib/theme.dart` and mirror the web's `--capture-*`
custom properties: cream paper `#F7F3EA`, ink `#050505`, hairline rules, and
yellow `#F2EB0C` at full strength on exactly one action per screen. The smiley
in `lib/widgets/brand_mark.dart` is byte-identical to the web's
`public/capture-this-smiley.png`; there is no vector source, so animate it as a
whole object and never trace it.

Supabase's persisted session and the legacy production token are stored in the
iOS Keychain. If the physical print succeeds but the server update fails, use
**Sync only**; do not print the label again. If print outcome is uncertain,
inspect the physical output and use the corresponding recovery action. Recovery
evidence survives an app restart and is never erased by auth refresh failure or
sign-out.

**Local dev on a physical iPhone:** the share URL must use your Mac's LAN IP, not `localhost` (e.g. `http://192.168.1.69:3000/run/…?token=…`). `next.config.ts` already allows dev origins for common LAN IPs.

## Data access

Normal signed-in operation calls Supabase directly with the public URL, public
anon key, and the user's session. Typed repositories read `productions`,
`clients`, `production_roster`, `people`, and `orders`, then adapt those rows
into the same `ProductionBoard` used by the roster, print queue, cache,
preview, and label renderer. It makes no request to `/api/public/*`.

The Days list is the exception to broad board loading: it calls the typed
`fetch_day_summaries()` aggregate and downloads only day identity, status,
date/client display values, and deterministic progress counts. `SetupController`
and `SetupRepository` own online setup state separately from `BoardController`;
multi-row setup changes use the `setup_*` Postgres functions and only update UI
state after the server returns success.

`WorkspaceRepository.completeDay()` calls the authenticated
`complete_production_day` function. The server locks the Active production,
rechecks its entire on-set order/print state, stamps completion metadata, and
returns authoritative counts in one transaction. The client refreshes after
success and never treats a local tap as proof of completion.

`BoardController` owns the authenticated server board plus its optimistic
outbox projection. Collect, Print, Home progress, cache, polling, and
Realtime-triggered refreshes all use that one projected board. Ordinary order
changes replay with a sparse update conditioned on the `updated_at` observed
before the first local edit. A mismatch becomes a visible conflict. Realtime is
only a signal to refetch; polling, resume, pull-to-refresh, and manual sync
remain authoritative fallback paths.

The following endpoints are retained only for **Legacy link** and the frozen web
fallback:

| Endpoint | Purpose |
|---|---|
| `GET /api/public/productions/{id}?token=…` | Full runner board (production, on-set roster, people, orders) |
| `PATCH /api/public/orders/{orderId}` | `{ productionId, token, patch: { label_printed: true } }` |

The native print path renders locally rather than downloading per-label PNGs.
Server-side PNG rendering remains available for web label export. The legacy
printer-queue endpoint is retained in source, but native queue derivation uses
the board. Consult callers for implementation facts; endpoint source is not
proof of deployment.

## Offline behaviour

Authenticated boards are cached to app-sandboxed preferences by authenticated
user ID + production ID (`lib/authenticated_workspace_cache.dart`). The selected
day is also stored per user. A cold start with no signal restores the Keychain
session, selected day, and cached roster immediately; printing works because
labels render on device. Signing out removes the board from memory, and a
different account can read only its own selected-day pointer and cached boards.

Order changes and print facts share a durable, coalescing per-order outbox.
Outbox records retain the first observed server revision, survive force-quit,
and are overlaid on the cached board at cold start. Ordinary fields stop on a
visible conflict. Confirmed `label_printed` facts replay independently and are
not retired merely because the optimistic board displays them.

The selected production's validated label-template snapshot is cached with its
authenticated board. A compatible remote snapshot becomes the last-known-good
template; a malformed or incompatible response never replaces it. Legacy
productions with no snapshot use the bundled Grid 01 definition.

The Legacy link cache remains in `lib/board_cache.dart`, scoped to `apiBase` +
`productionId`, and is cleared when that production is unlinked.

Staleness is shown, never hidden: the summary line reads
`Offline · synced 12 min ago`, and past ten minutes a banner says which orders
the operator may be missing. Cached data is never treated as server
confirmation. Sync cleanup requires a locally confirmed print and acknowledged
sync or a fresh server-confirmed print fact. An old server printed flag must not
erase an uncertain reprint; that still requires operator inspection.

A refused production is not the same as an unreachable one, and the app no
longer conflates them. `CtcApiException` carries a `CtcApiErrorKind`:

- `unreachable` — no signal, a timeout, a stall. The cached roster is still
  true, just old. It says **Working offline** and printing continues, which is
  the entire point of the cache.
- `gone` — the server answered and refused: 404, 401/403, revoked, expired, or
  a production marked **complete**, which drops out of
  `readableProductionStatuses` server-side. It says **This day is closed**,
  keeps the last roster on screen, and stops printing.

That second case used to report "Working offline" over a finished day and go on
printing, because the *cached* production status still said `active` — so
nothing downstream of the cache would stop it. `DeckBlock.unavailable` and the
guard at the top of `_printOneLabel` are both checked ahead of the cached
status for exactly that reason. Covered in `test/offline_cold_start_test.dart`
under "a production the server refuses".

## Label rendering

`lib/label_painter.dart` renders the production's declarative template at
591x354 (50x30mm @ 300 DPI). The canonical catalog lives in
`assets/label_templates/label-templates-v1.json` and is shared semantically
with the web renderer. It contains eight version-1 designs, including the
accepted legacy Grid 01. The schema is deliberately small: bounded flat
text/line/shape/mark elements, approved bindings and fonts, no URLs, code, or
executable content.

Arial is bundled from `assets/fonts/` rather than taken from iOS to keep font
selection consistent between host tests and devices. This does not eliminate
host rasterization differences or establish physical output quality.

### Visual regression and renderer comparison

Ordinary verification compares against existing baselines first. From `mobile/`,
select the checks relevant to the change:

```bash
flutter test --no-pub test/label_golden_test.dart
flutter test --no-pub test/app_store_screenshot_test.dart
```

[Label goldens](test/label_golden_test.dart) protect physical-label output in
[test/goldens/labels/](test/goldens/labels/). Run them on the accepted build
machine for exact local/release comparison; host rasterization differences need
investigation, not automatic acceptance. UI-only work must not change these PNGs.

[App Store screenshot tests](test/app_store_screenshot_test.dart) explicitly load
Geist, GeistMono, Arial, and Material Icons and compare against
[test/goldens/app-store/](test/goldens/app-store/). They are UI regression tests
and a source of fictional screenshot assets. Consult the
[release screenshot packet](../docs/build-13-app-review-unlisted-packet-2026-07-30.md#screenshot-set)
for asset context, and verify candidate identity before using assets for a release.
Screenshot tests do not prove device installation or Apple acceptance.

Inspect failures and their actual/expected/diff images before deciding whether a
change is intended. Keep diagnostic output available for review. Only after that
inspection, update the specific affected baseline with the test file and exact
test name selected, then inspect the PNG diff and rerun that comparison without
update mode. For example, **only for an intentional short-name label change**:

```bash
flutter test --no-pub test/label_golden_test.dart --plain-name 'renders grid-01-short-name' --update-goldens
flutter test --no-pub test/label_golden_test.dart --plain-name 'renders grid-01-short-name'
```

Do not use an unrestricted golden update to clear failures. For an intentional
UI screenshot change, select its named case in the screenshot test instead.

For cross-renderer composition review, run from the repository root:

```bash
node scripts/compare-label-renderers.mjs
```

The script renders server fixtures and reads existing Flutter label PNGs to
write stacked pairs into `.label-comparison/`. It does not run the Flutter
renderer or assert a regression pass, and covers only its listed Grid 01
fixtures. Run the label regression check first so those stored PNGs represent
the tested implementation. Its source comment about regeneration is fixture
preparation guidance, not a prerequisite to ordinary verification; regenerate
only intentionally affected fixtures using the targeted procedure above.

Inspect composition, wrapping, margins, and dimensions in the pairs. Flutter's
`TextPainter` and server canvas need not be byte-identical. Template changes also
follow [template authoring](../docs/label-template-authoring-and-publishing.md)
and require relevant rendering checks beyond this comparison subset. Neither
fixtures nor software goldens close the physical print gate.

## Setup (one-time)

### 0. Supply reviewed public Supabase configuration

The app refuses to guess or fall back to seed data. Release and device commands
must include the public project URL and public anon key:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Use the same defines with `flutter build ipa`. Never provide the service-role or
`sb_secret_…` key; the app rejects it and shows a sanitized setup state.

### 1. Prepare Flutter if needed

Skip installation when the existing Flutter environment is usable. Otherwise:

```bash
brew install --cask flutter
flutter doctor
```

`flutter doctor` will complain about Android — ignore anything Android-related, we only need the iOS checkmarks. If it asks, run:

```bash
sudo xcodebuild -license accept
sudo gem install cocoapods   # skip if `pod --version` already works
```

### 2. Use the checked-in iOS project

Run commands from `mobile/`. Use `flutter pub get` only if dependencies are
missing or changed. Preserve the exact `niim_blue_flutter: 1.0.1` pin.
Do not regenerate the release project with `flutter create .` as routine setup:
iPhone targeting, permissions, privacy manifest, signing configuration, and assets
are already checked in. Preserve the existing Podfile and lockfile; dependency
or platform migrations need their own scope and validation.

Open `ios/Runner.xcworkspace` for signing and use the public Supabase defines
above with `flutter run` on a connected, unlocked, trusted iPhone. Do not change
the bundle identifier or release signing settings incidentally. Follow the
[TestFlight checklist](../docs/testflight-checklist.md) for distribution.

The iOS Simulator cannot establish Bluetooth printing or physical haptics; use
the supported real iPhone/M2_H workflow for those checks.

## Print tuning

Constants at the top of `lib/printer_controller.dart`: `kPrintheadWidth`, `kDensity`, and
`kMinimumTextSideInkPixels`. The app scales the rendered label to the M2_H
printhead width while preserving aspect ratio. If output is too light/dark,
adjust `kDensity` and re-run.

`kMinimumTextSideInkPixels` guards against printing a blank label: below that
threshold the app overlays the name and drink as plain text. It predates local
rendering and is kept deliberately — it now catches a renderer bug rather than a
bad download. `test/label_render_test.dart` asserts real labels stay well above
it.

## Known quirks / troubleshooting

- **Flutter suggests removing CocoaPods during archive** → this is currently a
  migration notice to assess in the actual archive output, not a reason to
  discard the checked-in Podfile/lockfile and xcconfig includes. Do not remove CocoaPods or
  rewrite the iOS dependency setup during a release without a clean diff,
  archive comparison, and physical M2_H regression test.
- **Connect finds nothing** → NIIMBOT app still running somewhere (also check iPad/other phones), or the printer went to sleep (power-cycle it), or iOS Bluetooth permission was denied (Settings → Capture This).
- **Multiple printers found** → power off every NIIMBOT except the intended M2_H. The pinned printer library cannot safely select among scan results, so the app refuses to guess.
- **Print times out** → usually the RFID/roll check. Lid closed? Genuine roll? Ribbon installed (M2_H is thermal transfer)?
- **A print repeats or hangs** → stop, inspect the paper, and use the
  duplicate-safe recovery choice before attempting another label.
- **Output too light/dark** → change `kDensity` (1–5).
- **Do NOT update the printer firmware.** The supported protocol is reverse-engineered; preserve the accepted firmware baseline. Any firmware experiment requires dedicated hardware-validation scope.
- **Queue empty** → roster members need `on_set_today` and orders not in `no_order` status.
- **Mark printed fails** → production must be `active` (not `planning`). If the label physically printed, tap **Sync only** after connectivity returns.

## TestFlight and release evidence

Use the [documentation index](../docs/README.md#release-and-validation) to find
the applicable [TestFlight checklist](../docs/testflight-checklist.md), release
ledger, and exact-candidate physical worksheet. Keep build/upload/processing,
assignment, installation, Apple approval, and physical acceptance as separate
events with evidence. Do not infer them from the source version or an earlier
successful print.

For a replacement upload, inspect the actual consumed build numbers and choose
an unused suffix. Confirm `pubspec.yaml`, archive, exported IPA, and App Store
Connect identity agree; preserve the checked-in export options. Device/archive
commands require the reviewed public Supabase defines above. Distributed Legacy
link testing requires an HTTPS share URL, not a LAN/localhost URL. Record unresolved
external gates without marking them complete.
