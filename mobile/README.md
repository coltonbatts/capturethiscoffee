# CTC Printer — NIIMBOT M2_H BLE (iOS)

Native iOS app that prints Capture This Coffee cup labels directly to the NIIMBOT M2_H over Bluetooth LE — no NIIMBOT app, no laptop. Labels are rendered server-side by the Next.js app and fetched with the same production share-token auth the runner board uses.

## On-set workflow (Phase 2)

1. **Deploy or run CTC** with the new API routes (see repo root). Production must be **active** before `label_printed` updates will stick.
2. Open the **runner share link** on the production board (URL shape: `https://…/productions/{id}?token=…`).
3. On the iPhone, open **CTC Printer** → paste that full URL → **Link production**.
4. **Connect printer** (force-quit the official NIIMBOT app first).
5. Tap **Print** on each label in the queue. The app downloads the server PNG, prints, then marks `label_printed` via the public order PATCH route.
6. Use **Refresh** after runner-board changes. Toggle the chip to show already-printed labels.

**Local dev on a physical iPhone:** the share URL must use your Mac's LAN IP, not `localhost` (e.g. `http://192.168.1.69:3000/productions/…?token=…`). `next.config.ts` already allows dev origins for common LAN IPs.

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

`flutter create .` fills in the missing `ios/` folder around the files already here; it won't overwrite `lib/main.dart` or `pubspec.yaml`. (If it prompts about conflicts, keep OUR versions.)

### 3. iOS permissions + minimum version

Open `ios/Runner/Info.plist` and add inside the top-level `<dict>`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Connects to the NIIMBOT label printer to print coffee labels.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Connects to the NIIMBOT label printer to print coffee labels.</string>
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

- **Connect finds nothing** → NIIMBOT app still running somewhere (also check iPad/other phones), or the printer went to sleep (power-cycle it), or iOS Bluetooth permission was denied (Settings → CTC Printer).
- **Print times out** → usually the RFID/roll check. Lid closed? Genuine roll? Ribbon installed (M2_H is thermal transfer)?
- **Prints but repeats/hangs after page 1** → known heartbeat/print-task quirk on some models; grab the log, we'll adjust the heartbeat handling.
- **Output too light/dark** → change `kDensity` (1–5).
- **Do NOT update the printer firmware.** The open protocol is reverse-engineered; current firmware is confirmed working and the M2_H famously refuses downgrades.
- **Queue empty** → roster members need `on_set_today` and orders not in `no_order` status.
- **Mark printed fails** → production must be `active` (not `planning`).

## TestFlight

Step-by-step checklist: [docs/testflight-checklist.md](../docs/testflight-checklist.md).

Quick path:

```bash
cd mobile
flutter build ipa --release
open ios/Runner.xcworkspace   # Product → Archive → Distribute → App Store Connect
```

- Bundle ID: `com.capturethis.ctcprinter`
- Bump `version` in `pubspec.yaml` for each upload (`0.1.0+1`, `0.1.0+2`, …)
- Testers need **HTTPS** production share URLs (not LAN `http://`)
- Internal testers: no review. External testers: beta review + privacy policy URL.
- Builds expire after **90 days** — rebuild quarterly.
