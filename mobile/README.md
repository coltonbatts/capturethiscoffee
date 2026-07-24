# Capture This — NIIMBOT M2_H BLE (iPhone)

Native iOS app that prints Capture This cup labels directly to the NIIMBOT M2_H over Bluetooth LE — no NIIMBOT app, no laptop. Labels are rendered server-side by the Next.js app and fetched with the same production share-token auth the runner board uses.

The in-app help screen contains the condensed day-of workflow and duplicate-safe
recovery rules. The complete role-based handoff packet starts at
[`docs/HANDOFF.md`](../docs/HANDOFF.md).

## Primary on-set workflow

1. **Deploy or run Capture This** with the public API routes (see repo root).
   The production must be **Active**. Build 6 visibly pauses new physical
   printing for Planning productions.
2. Open the **runner share link** on the production board (URL shape: `https://…/run/{id}?token=…`; legacy `/productions/{id}` links also work during migration).
3. On the iPhone, open **Capture This** → paste that full URL → **Link production**.
4. **Connect printer** (force-quit the official NIIMBOT app first).
5. Tap **Print** on each label in the queue. The app downloads the server PNG, prints, then marks `label_printed` via the public order PATCH route.
6. Use **Refresh** after runner-board changes. Toggle the chip to show already-printed labels.

The linked production token is stored in the iOS Keychain. If the physical
print succeeds but the server update fails, use **Sync only**; do not print the
label again. If print outcome is uncertain, inspect the physical output and use
the corresponding recovery action. Recovery evidence survives an app restart.

**Local dev on a physical iPhone:** the share URL must use your Mac's LAN IP, not `localhost` (e.g. `http://192.168.1.69:3000/run/…?token=…`). `next.config.ts` already allows dev origins for common LAN IPs.

## API endpoints (share-token auth)

| Endpoint | Purpose |
|---|---|
| `GET /api/public/productions/{id}/labels?token=…` | Label queue JSON |
| `GET /api/public/orders/{orderId}/label?productionId=…&token=…` | Server-rendered PNG (`production-sticker-sheet` design) |
| `PATCH /api/public/orders/{orderId}` | `{ productionId, token, patch: { label_printed: true } }` |

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
`kMinimumTextSideInkPixels`. The app scales server PNGs to the M2_H printhead
width while preserving aspect ratio. If output is too light/dark, adjust
`kDensity` and re-run.

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
- Existing TestFlight pilot: `1.0.0+5`.
- Next handoff candidate: `1.0.0+6`. Its signed App Store IPA was built and
  inspected locally; it must be uploaded and physically accepted before
  replacing build 5.
- Bump the build suffix for every later upload (`1.0.0+7`, `1.0.0+8`, …).
- The checked-in export options keep Xcode from silently changing the IPA build
  number. Confirm `pubspec.yaml`, the archive, the exported IPA, and App Store
  Connect agree before uploading.
- Testers need **HTTPS** production share URLs (not LAN `http://`)
- Internal testers: no review. External testers: beta review + privacy policy URL.
- Builds expire after **90 days** — rebuild quarterly.
