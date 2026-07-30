# Capture This — NIIMBOT M2_H BLE (iPhone)

Native iOS app that prints Capture This cup labels directly to the NIIMBOT M2_H
over Bluetooth LE — no NIIMBOT app, no laptop. Labels are rendered **on device**
(`lib/label_painter.dart`) so printing never needs a signal. The `1.0.0 (12)`
release-candidate source signs an owner-provisioned operator into Supabase,
loads an existing day, collects and edits orders from its complete roster, and
durably queues order and physical print facts while offline. The Build 8
share-token path remains under **Legacy link** as the maintained fallback.
Build 12 adds online-only native pre-production setup:
day creation/editing, People, private photos, roster building/reordering, and
reviewed atomic bulk import.

The in-app help screen contains the condensed day-of workflow and duplicate-safe
recovery rules. The complete role-based handoff packet starts at
[`docs/HANDOFF.md`](../docs/HANDOFF.md).

As of 2026-07-25 this app is the product's primary surface and the web is
frozen. See
[`docs/current-state-2026-07-25.md`](../docs/current-state-2026-07-25.md) and
[`docs/app-first-direction-2026-07-25.md`](../docs/app-first-direction-2026-07-25.md).

## Primary on-set workflow

1. Open **Capture This** and sign in with an owner-provisioned email/password.
   There is no public signup.
2. Choose an existing Active day on **Days**. Planning and Complete days remain
   visible, but physical printing is paused unless the selected day is Active.
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

If account access is unavailable during migration, choose **Legacy link** from
Sign in, Days, or the setup screen and paste the runner share URL. That path is
the unchanged Build 8 behavior and still uses the frozen public Next.js APIs.

## Native setup workflow (Build 12)

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
5. Choose **Continue to Collect & Print**. That selection loads the same
   `ProductionBoard` used by Collect, Print, progress, offline cache, conflicts,
   and recovery. Setup has no local mutation outbox.

## Screen structure

Sign in and Days now precede the Build 8 day surfaces. Root state is coordinated
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
| **About** (`lib/screens/about_screen.dart`) | `/about` | Version, privacy, support, licenses. |
| **Legacy link** (`lib/screens/link_screen.dart`) | root state | Secondary Build 8 fallback. Paste a share link; validation answers under the field. |

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
into the same `ProductionBoard` used by the Build 8 roster, print queue, cache,
preview, and label renderer. It makes no request to `/api/public/*`.

The Days list is the exception to broad board loading: it calls the typed
`fetch_day_summaries()` aggregate and downloads only day identity, status,
date/client display values, and deterministic progress counts. `SetupController`
and `SetupRepository` own online setup state separately from `BoardController`;
multi-row setup changes use the `setup_*` Postgres functions and only update UI
state after the server returns success.

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

The app calls two routes it used to call and no longer does:

- `GET /api/public/orders/{orderId}/label` — downloading a PNG per label meant
  no signal, no printing, even for orders captured an hour earlier. That route
  still serves `/labels` on the web and is the comparison baseline for the
  on-device renderer.
- `GET /api/public/productions/{id}/labels` — the printer-queue endpoint only
  returned *captured* orders. The app reads the board instead and derives the
  print queue locally in `PrinterQueue.fromBoard`, which mirrors
  `buildPrinterQueue` in `src/lib/printer-queue.ts`. **Nothing calls the labels
  endpoint now**; it is still deployed and still tested on the web side.

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

The Legacy link cache remains in `lib/board_cache.dart`, scoped to `apiBase` +
`productionId`, and is cleared when that production is unlinked.

Staleness is shown, never hidden: the summary line reads
`Offline · synced 12 min ago`, and past ten minutes a banner says which orders
the operator may be missing. Cached data is never treated as server
confirmation — a print-recovery record is only retired when the server itself
reports `label_printed`.

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

`lib/label_painter.dart` renders `grid-01` at 591x354 (50x30mm @ 300 DPI), a
direct port of `drawGrid01` in `src/lib/niimbot-m2-draw.ts`. Coordinates are
copied verbatim; if the web design moves, this must move with it. Only
`grid-01` is ported — the other seven designs are a web-side playground.

Arial is bundled from `assets/fonts/` rather than taken from iOS so that
`flutter test` on a host machine and the device produce identical metrics.

The two renderers will never be byte-identical — `@napi-rs/canvas` and Flutter's
`TextPainter` shape text differently. What must match is composition. Check it:

```bash
flutter test test/label_golden_test.dart --update-goldens
cd .. && node scripts/compare-label-renderers.mjs
```

That writes stacked server/app pairs for four fixtures (short name, long name,
long drink, minimal). Look at them.

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

### 1. Install Flutter (~10 min)

```bash
brew install --cask flutter
flutter doctor
```

`flutter doctor` will complain about Android — ignore anything Android-related, we only need the iOS checkmarks. If it asks, run:

```bash
sudo xcodebuild -license accept
sudo gem install cocoapods   # skip if `pod --version` already works
```

### 2. Generate the iOS scaffolding

```bash
cd mobile
flutter create --project-name ctc_printer --platforms=ios .
flutter pub get
```

Do not rerun `flutter create .` over the release project without reviewing its
diff; the iPhone-only target, privacy manifest, signing settings, and app assets
are already checked in.

### 3. iOS permissions + minimum version

Open `ios/Runner/Info.plist` and add inside the top-level `<dict>`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Capture This uses Bluetooth to find and connect to your NIIMBOT M2_H and print coffee cup labels.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Capture This uses Bluetooth to connect to your NIIMBOT M2_H and print coffee cup labels.</string>
<key>NSCameraUsageDescription</key>
<string>Capture This uses the camera to add a crew photo that helps invited operators identify fictional and real roster members.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Capture This uses your photo library when you choose a crew photo for the private person directory.</string>
```

Open `ios/Podfile`, uncomment/set the platform line to:

```ruby
platform :ios, '13.0'
```

Then:

```bash
cd ios && pod install && cd ..
```

### 4. Signing

```bash
open ios/Runner.xcworkspace
```

In Xcode: Runner target → Signing & Capabilities → select your team, set a unique bundle ID (e.g. `com.capturethis.ctcprinter`). Since you have a paid developer account, automatic signing should just work.

### 5. Run it — on a REAL iPhone

```bash
flutter devices        # confirm the iPhone shows up (plugged in, unlocked, trusted)
flutter run
```

**The iOS Simulator has no Bluetooth. This only works on a physical device.**

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
  non-blocking migration notice. The signed Build 11 IPA succeeds with the
  checked-in Podfile/lockfile and xcconfig includes. Do not remove CocoaPods or
  rewrite the iOS dependency setup during a release without a clean diff,
  archive comparison, and physical M2_H regression test.
- **Connect finds nothing** → NIIMBOT app still running somewhere (also check iPad/other phones), or the printer went to sleep (power-cycle it), or iOS Bluetooth permission was denied (Settings → Capture This).
- **Multiple printers found** → power off every NIIMBOT except the intended M2_H. The pinned printer library cannot safely select among scan results, so the app refuses to guess.
- **Print times out** → usually the RFID/roll check. Lid closed? Genuine roll? Ribbon installed (M2_H is thermal transfer)?
- **A print repeats or hangs** → stop, inspect the paper, and use the
  duplicate-safe recovery choice before attempting another label.
- **Output too light/dark** → change `kDensity` (1–5).
- **Do NOT update the printer firmware.** The open protocol is reverse-engineered; current firmware is confirmed working and the M2_H famously refuses downgrades.
- **Queue empty** → roster members need `on_set_today` and orders not in `no_order` status.
- **Mark printed fails** → production must be `active` (not `planning`). If the label physically printed, tap **Sync only** after connectivity returns.

## TestFlight

Step-by-step checklist: [docs/testflight-checklist.md](../docs/testflight-checklist.md).

Quick path (with the reviewed Dart defines above):

```bash
cd mobile
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
open ios/Runner.xcworkspace   # Product → Archive → Distribute → App Store Connect
```

- Bundle ID: `com.capturethis.ctcprinter`
- Builds 5 through 10 are uploaded and **consumed**; none may be reused.
- Build 9 source is committed at `47c4405`. It adds signed-in day selection and
  direct Supabase data access. What the physical print baseline exists to test
  is in
  [docs/release-evidence-1.0.0.md](../docs/release-evidence-1.0.0.md).
- Build 10 `1.0.0+10` was uploaded and made available to the internal
  TestFlight tester on 2026-07-27. Physical acceptance remains open. See
  [docs/build-10-implementation-2026-07-25.md](../docs/build-10-implementation-2026-07-25.md).
- Build 11 `1.0.0+11` was uploaded and assigned to the existing internal
  TestFlight group on 2026-07-28. Its shipping deck exposes only individual
  printing; physical acceptance remains open.
- Build 12 `1.0.0+12` is the native-setup release candidate. Upload,
  processing, and internal assignment are recorded only after they occur.
- Bump the build suffix for every later upload (`1.0.0+12`, …).
- The checked-in export options keep Xcode from silently changing the IPA build
  number. Confirm `pubspec.yaml`, the archive, the exported IPA, and App Store
  Connect agree before uploading.
- A Legacy-link tester needs an **HTTPS** production share URL (not LAN
  `http://`); normal Build 11 operation uses invited-account sign-in.
- Internal testers: no review. External testers: beta review + privacy policy URL.
- Builds expire after **90 days** — rebuild quarterly.
