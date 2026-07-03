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
2. Choose the production and one or more active labels.
3. Preview the label.
4. Tap **Share** when the phone supports sharing PNG files, or **Export PNG**.
5. Open the NIIMBOT app.
6. Import the PNG and save it as a template (My Templates).
7. Repeat steps 1-6 for each cup. Import/save is still one at a time — there is no bulk-import of multiple external PNGs at once.
8. Once several templates are saved, use the NIIMBOT app's **Batch Print** feature (Home → My Templates → Batch Print) to multi-select them, set a copy count for each, and print the whole stack in one continuous pass instead of printing each cup individually.

Note: NIIMBOT's Batch Print does not accept templates built from a CSV/data source — that's a separate batch mechanism (see "Physical Unknowns" below) and the two don't combine.

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

## Source note

The Batch Print behavior described above (multi-select saved templates,
print in one pass, data-source templates excluded) comes from NIIMBOT's own
in-app help center, document id 4166, "How to Use Batch Printing?" — surfaced
2026-07-01. Not yet confirmed against the actual M2 + app on this printer;
treat as documented app behavior, not yet a verified CTC workflow.
