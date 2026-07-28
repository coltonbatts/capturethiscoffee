# Fallback Label Image Export

Capture This Coffee no longer runs a laptop print station, USB serial worker,
or web print queue. The primary on-set print path is now the native iOS
**CTC Printer** app in `mobile/`, which fetches server-rendered PNGs through the
share-token API, prints to the NIIMBOT M2_H over BLE, and marks
`label_printed`.

This document covers the fallback `/labels` export workflow for cases where CTC
Printer is unavailable or an advanced PNG/CSV export is needed.

## Fallback On-Set Workflow

1. Open `/labels` on the phone.
2. Choose the production and one active label.
3. Preview the label.
4. Tap **Share** when the phone supports sharing PNG files, or **Export PNG**.
5. Open the NIIMBOT app.
6. Import the PNG and save it as a template (My Templates).
7. Print exactly one physical label and inspect its person, drink, orientation,
   crop, density, feed, and stock before continuing.
8. Repeat steps 1–7 for each remaining cup. Do not start the next print until
   the prior physical result is known.

## Current Fallback Export Preset

The current assumed preset is stored in
`src/lib/niimbot-m2-preset.json`:

- 50mm x 30mm
- 300 DPI
- 591 x 354 pixels
- PNG image

This is an assumed preset, not a physically verified lid-label stock. Do not
present it as final until a physical print confirms it — the preset's own
description field says the same. Run
[docs/production-readiness-checklist.md](production-readiness-checklist.md)
Section A to verify, then record the result here and in the preset.

## Physical Unknowns To Verify

- Exact NIIMBOT lid-label media.
- Round vs rectangular stock.
- Actual millimeter dimensions.
- DPI and scaling behavior when importing a PNG into the NIIMBOT app.
- Printed result after a real phone import and physical label print.
- How long the "import PNG → save as template" step takes per cup on a real
  phone, and whether that's fast enough to do for a full crew run (20+
  cups) rather than just a few hero cups. See
  [docs/niimbot-m2-plan.md](niimbot-m2-plan.md) for the Path A/B tradeoff
  this feeds into.

Record the final media and import settings here after physical testing.

This fallback is intentionally sequential. Research into other NIIMBOT
workflows is preserved in historical investigation documents, but those paths
are not accepted Capture This release procedures.
