# Codex handoff — 2026-07-02 (BLE printer spike + Phase 2)

Copy everything below the `---` line into Codex (or any agent) with the repo root open.

---

You are taking over **Capture This Coffee** after a full day of NIIMBOT M2_H printer work. Read this handoff first, then `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/phone-printing-investigation.md`, and `mobile/README.md`. Verify file paths against the repo before editing — do not assume stale prompts.

## Executive summary

**What we proved today:** An iPhone can connect to a NIIMBOT **M2_H** over Bluetooth LE and print labels using the open **niimbluelib** protocol (via Flutter package `niim_blue_flutter` 1.0.1). Both a library-rendered text test and a PNG bitmap test printed successfully on physical 50×30 stock.

**What we shipped after the spike:** **Phase 2** — a native iOS app (`mobile/`) that links a production share URL, fetches a label queue + server-rendered PNGs from new Next.js API routes, prints over BLE, and marks `label_printed` via the existing public order PATCH route. All of this is on `main` as of commit `e05ad01` (pushed to GitHub).

**Strategic direction (settled — do not re-litigate):**

- Keep the NIIMBOT M2_H; no laptop print station; no Web Bluetooth from Safari.
- **Primary on-set path:** CTC Printer iOS app (`mobile/`).
- **Fallback:** `/labels` PNG share/download or NIIMBOT batch CSV through the official NIIMBOT app.
- Do **not** update printer firmware (reverse-engineered protocol; M2_H refuses downgrades).
- Force-quit the official NIIMBOT app before our app connects (it hogs BLE).

---

## Product context

Capture This Coffee (CTC) is a **Next.js 16.2.6** / **Supabase** app for live coffee orders on production shoots. It manages clients, people, productions, rosters, drink orders, coffee-shop summaries, and branded cup labels.

**Users:**

| Role | Tool |
|---|---|
| Admin | Web app — setup clients, people, productions, rosters |
| Runner | Web production board via **share-token URL** (no account) |
| Label operator | **CTC Printer** iOS app (`mobile/`) or `/labels` fallback |

**Label stock:** 50×30 mm, 300 DPI, printhead max **567 px** wide. Server/browser preset is **591×354 px** (`src/lib/niimbot-m2-preset.json`). App print constants are **560×352** (`mobile/lib/main.dart`) — tunable if physical output is offset.

**Printer:** NIIMBOT M2_H, model ID **4608**, thermal transfer (ribbon), gap labels (paper type 1), density 1–5 (default 3).

---

## What happened today (chronological)

### 1. Spike setup (was never compiled before today)

- Installed Flutter + CocoaPods on developer Mac via Homebrew.
- Ran `flutter create --project-name ctc_printer --platforms=ios .` inside `mobile/`.
- Added Bluetooth usage strings to `ios/Runner/Info.plist`.
- Bundle ID: `com.capturethis.ctcprinter`.
- Fixed `niim_blue_flutter` 1.0.1 API mismatches in `main.dart` (see below).
- Resolved Xcode signing (Apple Developer PLA acceptance, team selection, Developer Mode on iPhone).

### 2. Spike validation (human-confirmed on hardware)

- **Text test:** fully legible, good size/position.
- **PNG test (`assets/test_label.png`):** printed; **black strip at top** — acceptable for spike; likely scaling/placement (591×354 asset vs 560×352 print page). Tunable via `kPageWidth` / `kPageHeight` in `mobile/lib/main.dart`.
- BLE connect + B1 print task on M2_H from iOS: **go**.

### 3. Phase 2 implementation

**Next.js (server):**

- Split canvas drawing into `src/lib/niimbot-m2-draw.ts` (shared draw logic).
- Browser export remains `src/lib/niimbot-m2-export.ts` (thin wrapper).
- Server PNG render: `src/lib/niimbot-m2-export-server.ts` using `@napi-rs/canvas`.
- Queue helpers: `src/lib/printer-queue.ts`.
- Extended `runnerOrderFields` in `src/lib/production-share.ts` to allow `label_printed` on token-scoped PATCH.
- New API routes:
  - `GET /api/public/productions/[id]/labels?token=…`
  - `GET /api/public/orders/[id]/label?productionId=…&token=…` (PNG bytes)
- `next.config.ts`: `serverExternalPackages: ["@napi-rs/canvas"]`.
- `package.json`: `build` script uses `next build --webpack` (Turbopack failed on native canvas binding).
- Tests: `tests/printer-queue.test.ts`; updated `tests/production-share.test.ts`.

**Flutter (`mobile/`):**

- Replaced spike test UI with production flow: paste share URL → queue → connect printer → print → mark printed.
- `lib/production_session.dart` — parse/store share URL.
- `lib/ctc_api.dart` — HTTP client for queue, PNG, PATCH.
- `lib/main.dart` — UI + BLE print plumbing (heartbeat stop/restart preserved).
- Deps: `http`, `shared_preferences` (remembers linked production).
- `niim_blue_flutter` still pinned **exactly** `1.0.1`.

### 4. Docs + git

- Updated root `README.md` (label printing section, API table, verification commands).
- Updated `CLAUDE.md` (spike passed, Phase 2 active).
- Added `docs/phone-printing-investigation.md` (strategy history).
- Pushed to `main` on GitHub (`e05ad01`). **Not committed:** `docs/luke-update-2026-07.*`, `docs/presentation-prep-checklist.md` (local prep).

---

## Architecture (Phase 2)

```
┌─────────────────────────────┐         share-token auth          ┌──────────────────────────┐
│  Next.js (CTC web app)      │ ◄──────────────────────────────── │  CTC Printer (Flutter)   │
│  Supabase + service role    │                                   │  iPhone + BLE → M2_H     │
├─────────────────────────────┤                                   ├──────────────────────────┤
│  GET …/labels               │ ── JSON queue ──────────────────► │  List labels, filter     │
│  GET …/orders/{id}/label    │ ── PNG (591×354) ───────────────► │  Print via niim_blue     │
│  PATCH …/orders/{id}        │ ◄── { label_printed: true } ───── │  After successful print  │
│  niimbot-m2-draw.ts         │   server renders same designs     │  Scales to 560×352 page  │
│  @napi-rs/canvas            │   as /labels (default design:     │                          │
│                             │   production-sticker-sheet)       │                          │
└─────────────────────────────┘                                   └──────────────────────────┘
```

**Auth:** Same production share token as runner board (`production_share_tokens`, SHA-256 hashed). No new auth system.

**Queue contents:** On-set roster (`on_set_today`), orders not in `no_order`, via `labelExportItemsForProduction()` logic in `src/lib/printer-queue.ts`.

**PATCH constraint:** Production must be **`active`** (not `planning`) for order updates including `label_printed`.

---

## Key files map

| Area | Path | Notes |
|---|---|---|
| Flutter app entry | `mobile/lib/main.dart` | Print constants, UI, BLE |
| Flutter API client | `mobile/lib/ctc_api.dart` | Queue, PNG, PATCH |
| Share URL parsing | `mobile/lib/production_session.dart` | |
| Mobile setup/run | `mobile/README.md` | |
| Label draw (shared) | `src/lib/niimbot-m2-draw.ts` | All design variants |
| Browser PNG export | `src/lib/niimbot-m2-export.ts` | Uses canvas in browser |
| Server PNG export | `src/lib/niimbot-m2-export-server.ts` | Node only |
| Queue builder | `src/lib/printer-queue.ts` | |
| Share-token security | `src/lib/production-share.ts` | Includes `label_printed` |
| Label queue API | `src/app/api/public/productions/[id]/labels/route.ts` | |
| Label PNG API | `src/app/api/public/orders/[id]/label/route.ts` | |
| Order PATCH API | `src/app/api/public/orders/[id]/route.ts` | Existing |
| Preset dimensions | `src/lib/niimbot-m2-preset.json` | |
| Strategy doc | `docs/phone-printing-investigation.md` | |
| Stale spike prompt | `mobile/HANDOFF_PROMPT.md` | **Out of date** — spike done |

---

## niim_blue_flutter API corrections (1.0.1)

The spike `main.dart` was written against docs; actual package types differ:

| Assumed | Actual |
|---|---|
| `labelType: int` | `LabelType.fromValue(kLabelType)` (`LabelType.withGaps` = 1) |
| `TextOptions` x/y as `double` | `int` |
| `LineOptions` endX/endY as `double` | `int` |
| `ImageFromBufferOptions.buffer` as decoded `Image` | `Uint8List` (raw PNG bytes) |
| `addText` sync | `await page.addText(...)` (async) |

`setPacketInterval(0)` and heartbeat stop/restart around print jobs are correct — preserve that pattern.

---

## Verified vs unverified

| Claim | Status |
|---|---|
| iPhone → M2_H BLE connect + text print | **Verified** on hardware today |
| iPhone → M2_H PNG print | **Verified** (minor top strip artifact) |
| Phase 2 end-to-end (API → phone → print → `label_printed`) | **Implemented, not fully re-tested** after UI swap — human should run one label through deployed API |
| Server PNG matches `/labels` browser output | **Assumed** (same draw code); not pixel-diff tested |
| 591×354 preset vs physical roll | **Still P0** — see `docs/label-image-export.md` |
| Production deployment has `SUPABASE_SERVICE_ROLE_KEY` | **Must confirm** before on-set use |
| TestFlight distribution | **Not started** |

---

## On-set operator checklist

1. Deployed CTC with `SUPABASE_SERVICE_ROLE_KEY` set.
2. Production status = **`active`**.
3. Share token generated; URL shape: `/productions/{id}?token=…`.
4. On iPhone: **CTC Printer** → paste URL → Link production.
5. Force-quit **NIIMBOT official app**.
6. M2_H on, genuine **RFID roll** + ribbon, lid closed.
7. Connect printer → Print labels from queue.
8. Local dev: share URL must use **Mac LAN IP**, not `localhost`.

---

## Known issues / backlog (priority order)

### P0 — Validate Phase 2 on real shoot data

- Run one full cycle: link production → print one real order label → confirm `label_printed` in Supabase/runner board.
- Fix PNG vertical positioning if black strip persists on server-rendered labels (tune `kPageWidth`/`kPageHeight` or server→print scaling).
- Physical verify 591×354 preset against actual roll (`docs/label-image-export.md`).

### P1 — Product polish

- QR scan for share link (currently paste-only).
- Label previews in Flutter queue before print.
- TestFlight build for Luke's phone (internal testing, 90-day rebuild cycle).
- `pod deintegrate` / SPM-only iOS deps (Flutter warns about mixed CocoaPods + SPM).

### P1 — Web app (unchanged backlog from CLAUDE.md)

- Realtime sync on runner board.
- Reduce `src/lib/data.ts` dual-mode complexity.
- Admin UI for share-token generation (currently SQL in README).

### P2

- xlsx-bridge export on `/labels` (Path A in investigation doc) as permanent fallback.
- Email NIIMBOT developer SDK program (free, optional).

---

## Guardrails for the next agent

1. **Do not** propose laptop print station, Web Bluetooth, or reverting to NIIMBOT app as the primary path.
2. **Do not** loosen `niim_blue_flutter` pin (stay at **1.0.1**).
3. **Do not** suggest printer firmware updates.
4. Read Next.js 16 docs in `node_modules/next/dist/docs/` before changing routing/proxy (`src/proxy.ts`, not `middleware.ts`).
5. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser or Flutter — public routes use it server-side only.
6. Add tests for changes to `src/lib/production-share.ts` (security boundary).
7. Explain mobile/Xcode conventions in plain language — developer is self-taught.
8. Prefer minimal diffs; don't refactor unrelated files.

---

## Commands

```bash
# Web app
npm install
npm run dev          # http://localhost:3000
npm run lint
npm test             # 28 tests as of 2026-07-02
npm run build        # uses webpack (required for @napi-rs/canvas)

# iOS printer app (physical device only for BLE)
cd mobile
flutter pub get
flutter analyze
flutter test
flutter devices
flutter run -d <device-id>   # bundle: com.capturethis.ctcprinter

# Label export sanity check
npm run verify:niimbot-export
```

---

## Suggested first Codex prompt (after reading this file)

```text
You are continuing Capture This Coffee printer work. The M2_H BLE spike passed and Phase 2 is on main (commit e05ad01). Read docs/codex-handoff-2026-07-02.md, CLAUDE.md, README.md, mobile/README.md, and src/lib/production-share.ts.

My task: [describe task — e.g. "run Phase 2 end-to-end against deployed Supabase", "fix PNG top strip on print", "add QR scan to mobile app", "TestFlight setup"].

Respect all guardrails in the handoff. Report: files changed, behavior changed, tests run, and anything still unverified on hardware or deployment.
```

---

## Git reference

- **Branch:** `main`
- **Latest relevant commit:** `e05ad01` — "Add native iOS BLE printer app and server label API."
- **Remote:** `https://github.com/coltonbatts/capturethiscoffee`
