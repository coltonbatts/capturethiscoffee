# Capture This — NIIMBOT M2_H BLE (iPhone)

Native iOS app that prints Capture This cup labels directly to the NIIMBOT M2_H
over Bluetooth LE — no NIIMBOT app, no laptop. Labels are rendered **on device**
(`lib/label_painter.dart`) so printing never needs a signal; the app reaches the
server only to read the board and report `label_printed`, using the same
production share-token auth the runner board uses.

The in-app help screen contains the condensed day-of workflow and duplicate-safe
recovery rules. The complete role-based handoff packet starts at
[`docs/HANDOFF.md`](../docs/HANDOFF.md).

As of 2026-07-25 this app is the product's primary surface and the web is
frozen. See [`docs/app-first-direction-2026-07-25.md`](../docs/app-first-direction-2026-07-25.md).

## Primary on-set workflow

1. **Deploy or run Capture This** with the public API routes (see repo root).
   The production must be **Active**. Build 6 visibly pauses new physical
   printing for Planning productions.
2. Open the **runner share link** on the production board (URL shape: `https://…/run/{id}?token=…`; legacy `/productions/{id}` links also work during migration).
3. On the iPhone, open **Capture This** → paste that full URL → **Link production**.
4. **Connect printer** (force-quit the official NIIMBOT app first).
5. Work the **deck**: it shows the next label at real size with one action —
   **Print this label**. The app renders on device, prints, then marks
   `label_printed` via the public order PATCH route. **Print all** runs the
   whole pending queue and stops on the first failure.
6. To print someone out of order, find them in the **roster** below the deck and
   tap the print icon on their row.

## Screen structure

A home screen and four routes. Splash, link, and home are not routes — they are
states of `RootScreen`, because there is nothing to navigate *back* to from a
cold start and an operator with no linked production has one thing to do.

| Surface | Route | What it is |
|---|---|---|
| **Home** (`lib/screens/home_screen.dart`) | — | Where you land and return to. The mark, the day, and one entry per destination, each carrying its own state. |
| **Deck** (`lib/screens/print_screen.dart`) | `/print` | Production name, sync age, labels-left, the next label, and one action. |
| **Roster** (`lib/screens/roster_screen.dart`) | `/roster` | Search, To print / Printed / All with counts, dense rows that expand in place. |
| **Unresolved** (`lib/screens/recovery_screen.dart`) | `/recovery` | The only place a print outcome can be resolved. |
| **About** (`lib/screens/about_screen.dart`) | `/about` | Version, privacy, support, licenses. |
| **Link** (`lib/screens/link_screen.dart`) | root state | Paste a share link. Validation answers under the field. |

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

The linked production token is stored in the iOS Keychain. If the physical
print succeeds but the server update fails, use **Sync only**; do not print the
label again. If print outcome is uncertain, inspect the physical output and use
the corresponding recovery action. Recovery evidence survives an app restart.

**Local dev on a physical iPhone:** the share URL must use your Mac's LAN IP, not `localhost` (e.g. `http://192.168.1.69:3000/run/…?token=…`). `next.config.ts` already allows dev origins for common LAN IPs.

## API endpoints (share-token auth)

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

The last board the server returned is cached to `shared_preferences`
(`lib/board_cache.dart`), scoped to `apiBase` + `productionId`. A cold start
with no signal shows that roster immediately and printing works, because labels
render on device. The cache is cleared when the production is unlinked.

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
<string>Capture This uses Bluetooth to find and connect to your NIIMBOT M2_H so you can print coffee labels for the linked production.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Capture This uses Bluetooth to connect to your NIIMBOT M2_H and send coffee labels for printing.</string>
```

Open `ios/Podfile`, uncomment/set the platform line to:

```ruby
platform :ios, '12.0'
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

Constants at the top of `lib/main.dart`: `kPrintheadWidth`, `kDensity`, and
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
  non-blocking migration notice. The signed build-6 IPA succeeds with the
  checked-in Podfile/lockfile and xcconfig includes. Do not remove CocoaPods or
  rewrite the iOS dependency setup during a release without a clean diff,
  archive comparison, and physical M2_H regression test.
- **Connect finds nothing** → NIIMBOT app still running somewhere (also check iPad/other phones), or the printer went to sleep (power-cycle it), or iOS Bluetooth permission was denied (Settings → Capture This).
- **Multiple printers found** → power off every NIIMBOT except the intended M2_H. The pinned printer library cannot safely select among scan results, so the app refuses to guess.
- **Print times out** → usually the RFID/roll check. Lid closed? Genuine roll? Ribbon installed (M2_H is thermal transfer)?
- **Prints but repeats/hangs after page 1** → known heartbeat/print-task quirk on some models; grab the log, we'll adjust the heartbeat handling.
- **Output too light/dark** → change `kDensity` (1–5).
- **Do NOT update the printer firmware.** The open protocol is reverse-engineered; current firmware is confirmed working and the M2_H famously refuses downgrades.
- **Queue empty** → roster members need `on_set_today` and orders not in `no_order` status.
- **Mark printed fails** → production must be `active` (not `planning`). If the label physically printed, tap **Sync only** after connectivity returns.

## TestFlight

Step-by-step checklist: [docs/testflight-checklist.md](../docs/testflight-checklist.md).

Quick path:

```bash
cd mobile
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
open ios/Runner.xcworkspace   # Product → Archive → Distribute → App Store Connect
```

- Bundle ID: `com.capturethis.ctcprinter`
- Builds 5, 6, and 7 are uploaded and **consumed**; none may be reused.
- Current source is `1.0.0+8`, bumped for the UI rework and not yet built or
  uploaded. What it exists to test is in
  [docs/release-evidence-1.0.0.md](../docs/release-evidence-1.0.0.md).
- Bump the build suffix for every later upload (`1.0.0+9`, …).
- The checked-in export options keep Xcode from silently changing the IPA build
  number. Confirm `pubspec.yaml`, the archive, the exported IPA, and App Store
  Connect agree before uploading.
- Testers need **HTTPS** production share URLs (not LAN `http://`)
- Internal testers: no review. External testers: beta review + privacy policy URL.
- Builds expire after **90 days** — rebuild quarterly.
