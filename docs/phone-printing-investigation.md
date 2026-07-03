# Phone-only label printing: investigation + recommendation

Date: 2026-07-02
Goal: get order data from the CTC web app onto printed M2_H labels, few taps, no laptop.
Constraint honored throughout: iPhone on set, Safari has no Web Bluetooth, laptop path is dead.

> Status as of 2026-07-03: historical strategy record. Path B shipped as the
> native iOS **CTC Printer** app and is now the primary on-set path. Path A
> (`/labels` PNG/CSV export through the official NIIMBOT app) remains
> fallback/advanced export context, not the main workflow.

## TL;DR recommendation

Do both, in this order:

1. **This week — Path A (smarter bridge, ~1–2 days of code + 1 hour of physical testing).** Add a "Export for NIIMBOT (.xlsx)" button to CTC that produces a file matching Luke's saved NIIMBOT template, shared straight from Safari's share sheet. This kills the "manually rebuild the template" step immediately. The NIIMBOT app keeps doing what it's good at (pairing, printing).
2. **Next month — Path B (thin native app, ~2–5 weeks to trustworthy).** A tiny iOS app whose only job is: pull pending labels from CTC → send bitmaps to the M2_H over Bluetooth LE → done. The protocol is proven on this exact printer model by the community. This removes the NIIMBOT app from the loop entirely.
3. **Today, free — email NIIMBOT developer support** (liqingsong@niimbot.com or the form at niimbot.com/us/developer_work_order). They have an official iOS/Flutter SDK program for integrators. If they hand over the SDK, Path B gets dramatically safer. Costs nothing to ask; 1–2 business day response claimed.

---

## 1. Audit: can we automate the official NIIMBOT app?

Short answer: **no automation surface exists.** I searched for URL schemes (`niimbot://`), x-callback-url, iOS Shortcuts actions, and share extensions across NIIMBOT's docs, the App Store listing, GitHub, forums, and the community wiki (printers.niim.blue). Nothing documented, and nobody in the community has found one either. NIIMBOT's "developer support" is a request-based SDK program for building *your own* app — it doesn't expose hooks into *their* app.

What the official app **does** support (confirmed via NIIMBOT's own tutorial):

- In a label template: **Data source → Link data source → pick an Excel file → batch print.** The file is chosen through a file picker inside the app.
- This is the whole ingestion story. No deep links, no pre-filled data, no Shortcuts.

Two practical findings that matter:

- The file picker flow means a file that lands in the iOS **Files app** (which Safari downloads go to) should be selectable without any cable or computer. *Unverified assumption: I could not confirm from documentation that the in-app picker uses the standard iOS document picker with Files access — this needs a 10-minute test on Luke's phone. High confidence, but test it.*
- The import format is **brittle and undocumented**. A user comment on NIIMBOT's own blog (May 2025) reports "file can not parse" errors after an app update, with no published spec or template to check against. So: generate a real `.xlsx` (not a renamed CSV), keep a single simple header row, and expect to iterate once against the actual app.

## 2. Path A — smarter bridge (low effort, keeps NIIMBOT app)

### What changes in CTC

We already have `niimbotBatchCsv()` in `src/lib/label-export.ts` (header row + `"crew name","drink"` rows). The upgrade:

- Generate a genuine **`.xlsx`** client-side with SheetJS (~50 lines; SheetJS is already in Claude's/our toolbox and runs fine in the browser). Column headers must exactly match the data fields in Luke's saved NIIMBOT template.
- Trigger the **Web Share API** (`navigator.share({ files: [...] })`) on the export button. On iOS Safari this opens the share sheet, so it's: tap Export → tap "Save to Files" (or possibly straight into NIIMBOT — see tests below).
- Keep the existing PNG export path for hero/client cups — that already works and stays.

### On-set flow after this ships

One-time setup (once, ever): Luke builds the label template in the NIIMBOT app with data-source fields, saves it.

Per shoot: CTC → Export button → share sheet → Save to Files → open NIIMBOT app → open template → Link data source → pick the file → batch print. Roughly **6–8 taps, zero typing, zero template rebuilding.**

### Effort

- Code: 1–2 days including a test for the xlsx content (mirroring `tests/label-export.test.ts`).
- Physical validation: ~1 hour with the printer and Luke's iPhone.

### What's confirmed vs. not

| Claim | Status |
|---|---|
| NIIMBOT app batch-prints from an imported Excel file | Confirmed (official tutorial) |
| In-app picker can reach files saved from Safari via Files app | **Unverified — test** |
| Exact accepted format (.xlsx vs .csv, header rules) | **Unverified — no spec exists; iterate once against the app** |
| NIIMBOT app appears as a direct share-sheet target ("Copy to NIIMBOT") | **Unverified — test; would save 2 taps if yes** |
| Template + column mapping persists between shoots, so re-import is quick | **Unverified — test; if mapping resets every import, this path loses most of its value** |

That last row is the real risk of Path A. If the app forces re-mapping columns on every import, the win shrinks from "huge" to "moderate."

## 3. Path B — replace the app (thin native printer app)

### Why it's genuinely viable now

- **The M2_H speaks Bluetooth LE**, not just Bluetooth Classic. Per the community wiki, every NIIMBOT printer exposes both a BLE and a Classic address; niimbluelib talks to the standard BLE characteristic (`bef8d6c9-…` on service `e7810a71-…`). This matters because third-party iOS apps can only use BLE (Classic requires Apple MFi certification). BLE support = an iOS app *can* talk to this printer.
- **Someone already printed on this exact model via the open protocol over Bluetooth.** In niimbluelib's tested-models thread, a user confirmed an M2 (modelId **4608** — same ID as ours) printing through niimbluelib over browser Bluetooth, using the B1 print task. Their caveats, all manageable: a valid RFID label roll must be in the printer (we use genuine stock — fine), select an integer dots-per-mm, and there's a heartbeat quirk (send one heartbeat before printing, don't run periodic heartbeats mid-print).
- **iOS ports of the protocol exist:**
  - [`niim_blue_flutter`](https://pub.dev/packages/niim_blue_flutter) — Flutter, based on niimbluelib, iOS supported, includes text/QR/image rendering and the B1 print task. **Caveat: very young.** v1.0.1 (Dec 2025), single unverified publisher, ~600 downloads. Treat as a working reference, not a battle-tested dependency.
  - [`libreniim`](https://github.com/talaviram/libreniim) — a native **Swift**/SwiftUI open-source NIIMBOT app, on TestFlight, MIT-licensed, uses AsyncBluetooth over CoreBluetooth. Proof that the Swift+CoreBluetooth route works end-to-end on iPhone. Caveat: author only tested a D110, 1 maintainer.
  - Official NIIMBOT SDK (iOS, Flutter, uni-app) — exists, request-based, terms/cost unknown. Worth the email.

### The architecture that keeps this small

Don't rebuild label design in the native app. Keep CTC as the brain:

```
CTC web app (existing)                    Tiny iOS app (new)
─────────────────────                     ──────────────────
label rendering (canvas → PNG,   ──API──▶ 1. fetch pending labels
567px wide, already built in              2. show list + preview
niimbot-m2-export.ts, ported to           3. tap Print → send bitmap
a server route with `sharp`)                 over BLE (B1 print task)
share-token auth (existing                4. mark label_printed via
production-share.ts pattern)                 existing PATCH route
```

The native app never draws a label — it downloads finished PNGs and shovels pixels to the printer. All six label designs, fonts, and future design work stay in the codebase you already have. The app is maybe 4 screens: connect printer, pick production (via share link/QR), label queue, print.

### Effort estimate (honest, for you + Claude Code)

- **Week 1:** proof of life. Flutter project + `niim_blue_flutter` (or Swift cribbing from libreniim), hardcoded PNG, get one label out of the M2_H from an iPhone. This is the go/no-go gate — everything else is normal app work.
- **Weeks 2–3:** Supabase/API integration (reuse the share-token routes — no new auth system), queue UI, `label_printed` sync, error handling for the flaky realities (printer asleep, out of ribbon, BLE drop mid-batch).
- **Weeks 4–5:** on-set hardening, TestFlight distribution, Luke feedback loop.

Call it **2–5 weeks of part-time vibe-coding**, front-loaded so you know by end of week 1 whether it works.

### Distribution — plainly

You do **not** need App Store review to put this on Luke's phone. Options:

- **TestFlight internal testing** (recommended): needs an Apple Developer account ($99/yr). Add Luke as an internal tester; internal builds don't go through App Store review. Builds expire after 90 days, so you rebuild quarterly — fine.
- Public App Store later, only if you ever want to. Apps driving BLE printers are common; review risk is low but nonzero and irrelevant for now.
- No developer account at all (free provisioning) makes builds expire every 7 days — not workable for a production tool.

### Risks / unknowns for Path B

- **niim_blue_flutter on M2_H on iOS specifically is unverified.** The M2 confirmation was via desktop Chrome. BLE is BLE, but pairing/connection behavior differs across stacks; week 1 exists to answer this.
- **Protocol is community-reverse-engineered and alpha.** A NIIMBOT firmware update could change behavior (the M2_H notoriously refuses firmware downgrades). Mitigation: don't update printer firmware once it works.
- **RFID stock:** printing via the open protocol still requires a valid RFID-tagged genuine roll in the printer and still decrements the roll's print counter. We already use genuine holographic stock, so this costs nothing extra — just don't buy blank third-party rolls expecting them to work.
- **Thermal transfer quirks:** M2_H is ribbon-based (paper types 1,5,2,10; density 1–5, default 3); density/dpmm settings needed a tweak in the community test.
- **Bus factor:** both candidate libraries are single-maintainer. Mitigation: the protocol itself is documented on printers.niim.blue, and the code is MIT — worst case we vendor it.

## 4. Comparison

| | Path A: bridge | Path B: native app |
|---|---|---|
| Effort | 1–2 days + 1 hr testing | 2–5 weeks part-time |
| Taps on set | ~6–8 per batch | ~2–3 per batch |
| NIIMBOT app dependency | Still there (import format can break on app updates) | Gone |
| New costs | none | $99/yr Apple Developer |
| Biggest unknown | picker/format/mapping persistence (1 test session answers all) | BLE from iOS to M2_H (week 1 answers it) |
| Failure mode | NIIMBOT update breaks parsing → stuck until we adapt the file | firmware update breaks protocol → don't update firmware |
| Hero/client PNG labels | unchanged (NIIMBOT app import) | native app prints them directly — even better |

They're not competing: A is the tourniquet, B is the cure, and A remains the fallback forever if B has a bad day on set.

## 5. What I need from you

1. **10-minute phone test (unblocks Path A):** on the iPhone with the NIIMBOT app — (a) save any .xlsx from Safari to Files, (b) open a template → Data source → Link data source, and see if you can pick that file; (c) note whether the app shows up as a share-sheet target; (d) import twice and note whether column mapping persists. Report back and I'll build the export to match.
2. **The exact fields Luke's template uses** (name + drink only, or more?), so the xlsx columns match 1:1.
3. **Decision for Path B:** Flutter (`niim_blue_flutter`, fastest start) vs Swift (libreniim as reference, more native, more code). My lean: start Flutter for the week-1 spike since the library already implements the print task; switch only if it fails.
4. **Apple Developer account** ($99/yr) — only needed when Path B's spike succeeds.
5. **Physical access to the M2_H + iPhone** for the week-1 spike.
6. Optional, free: send the NIIMBOT developer-support form now so the SDK answer arrives before we're deep in Path B.

## Sources

- [NIIMBOT official Excel batch-print tutorial (mobile)](https://niimbots.com/blogs/news/how-to-print-labels-from-excel-with-niimbot-label-printer-mobile-phone) — import flow + user comments on parse errors
- [NIIMBOT Developer Support / SDK program](https://www.niimbot.com/us/developer_work_order)
- [NIIMBOT Community Wiki — connecting (BLE vs Classic, characteristic UUIDs)](https://printers.niim.blue/interfacing/connecting/)
- [NIIMBOT Community Wiki — M2_H hardware page](https://printers.niim.blue/hardware/niimbot-m2h/)
- [NIIMBOT Community Wiki — label RFID tags](https://printers.niim.blue/other/rfig-tags/)
- [niimbluelib tested models — M2 (modelId 4608) confirmation with caveats](https://github.com/MultiMote/niimbluelib/issues/1)
- [niim_blue_flutter on pub.dev](https://pub.dev/packages/niim_blue_flutter)
- [libreniim (Swift, iOS/macOS, TestFlight)](https://github.com/talaviram/libreniim)
