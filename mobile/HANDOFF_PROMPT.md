# Cursor handoff prompt

Copy everything below the line into Cursor (agent mode, repo root open).

---

You are taking over a working spike in the Capture This Coffee repo. Read `CLAUDE.md`, `docs/phone-printing-investigation.md`, `mobile/README.md`, `mobile/pubspec.yaml`, and `mobile/lib/main.dart` before writing any code.

## Context (do not re-derive or second-guess this)

- Capture This Coffee (CTC) is a Next.js 16 / Supabase app that manages live coffee orders on production shoots and generates branded 50x30mm cup-label PNGs (567px max printable width, 300 DPI) for a NIIMBOT M2_H thermal-transfer printer (model ID 4608).
- The strategic decision is made: we are building a minimal native iOS app (Flutter) that prints directly to the M2_H over Bluetooth LE using the reverse-engineered NIIMBOT protocol, via the `niim_blue_flutter` package (pub.dev, pinned exactly at 1.0.1 — the protocol lib is alpha, do not loosen the pin). This replaces a manual Excel-import workflow in NIIMBOT's official app. Do NOT propose alternatives: no laptop print station, no Web Bluetooth (the on-set phone is an iPhone; Safari/iOS has no Web Bluetooth), no reverting to the official NIIMBOT app.
- The current milestone is a go/no-go spike: prove an iPhone can connect to the M2_H over BLE and print (a) a library-rendered text label and (b) a bundled bitmap (`mobile/assets/test_label.png`, 560x352). `mobile/lib/main.dart` implements this but has NEVER been compiled — it was written against niim_blue_flutter 1.0.1's documented API. Expect small API mismatches.

## Your job, in order

1. Finish project setup per `mobile/README.md`: run `flutter create --project-name ctc_printer --platforms=ios .` inside `mobile/` (it must NOT overwrite the existing `pubspec.yaml`, `lib/main.dart`, or `assets/`), `flutter pub get`, add the two Bluetooth usage-description keys to `ios/Runner/Info.plist`, set `platform :ios, '12.0'` in the Podfile, `pod install`.
2. Get `mobile/` compiling with zero analyzer errors. If the niim_blue_flutter API differs from what `main.dart` assumes, fix `main.dart` against the package's actual source (read it in `.pub-cache` or its repo, github.com/kidwar/flutter-niimblue-lib) — keep the app's structure and on-screen logging intact.
3. Build to a physical iPhone (Simulator has no Bluetooth). Signing uses the developer's existing paid Apple Developer account; bundle ID `com.capturethis.ctcprinter`.
4. Stop there. Physical print testing happens with the human holding the printer. Do not start Phase 2 (Supabase queue integration) until the human confirms both test labels printed.

## Hardware/protocol facts (already verified — respect these)

- M2_H: 300 DPI, printhead 567px (48mm), print direction top, density 1–5 (default 3), paper type 1 = gap labels, thermal transfer (needs ribbon).
- Community-confirmed on this exact model via niimbluelib: B1 print task works; a genuine RFID label roll must be installed or prints time out; keep image width a multiple of 8; heartbeat must not run during a print job (the spike code stops/restarts it — preserve that).
- The official NIIMBOT app hogs the BLE connection; it must be force-quit before our app connects. Never suggest updating printer firmware — the protocol is reverse-engineered against current firmware and the M2_H refuses downgrades.

## Guardrails

- Work only inside `mobile/`. Do not touch the Next.js app (`src/`), Supabase schema, or existing tests.
- Follow `AGENTS.md` if it applies to your changes.
- Keep `niim_blue_flutter` pinned at exactly 1.0.1. Keep the tunable constants (`kPageWidth`, `kPageHeight`, `kDensity`, `kLabelType`) at the top of `main.dart`.
- The developer is a self-taught vibe coder: explain any mobile-dev conventions you rely on (signing, provisioning, CocoaPods, TestFlight) in plain language as you go, and prefer the simplest working solution over clever architecture.

## Phase 2 preview (context only — do not build yet)

After the spike passes: a Next.js API route renders order-label PNGs server-side (porting the canvas drawing in `src/lib/niimbot-m2-export.ts`, `sharp` is available), authenticated with the existing share-token pattern in `src/lib/production-share.ts`; the Flutter app fetches a label queue, prints on tap, and marks `label_printed` via the existing public PATCH route.

Report back with: files changed, whether the build succeeds on device, and any API corrections you had to make to `main.dart`.
