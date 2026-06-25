# Label Image Export

Capture This Coffee no longer runs a laptop print station, USB serial worker,
custom print queue, or custom NIIMBOT Bluetooth flow.

The app's job is to generate a polished, print-ready PNG label. The PA prints it
through NIIMBOT's first-party app on the phone paired to the printer.

## On-Set Workflow

1. Open `/labels` on the phone.
2. Choose the production and one or more active labels.
3. Preview the label.
4. Tap **Share** when the phone supports sharing PNG files, or **Download PNG**.
5. Open the NIIMBOT app.
6. Import the PNG and print through NIIMBOT's Bluetooth flow.

## Current Export Preset

The current assumed preset is stored in
`src/lib/niimbot-m2-preset.json`:

- 50mm x 30mm
- 300 DPI
- 591 x 354 pixels
- PNG image

This is an assumed preset, not a physically verified lid-label stock. Do not
present it as final until a physical print confirms it.

## Physical Unknowns To Verify

- Exact NIIMBOT lid-label media.
- Round vs rectangular stock.
- Actual millimeter dimensions.
- DPI and scaling behavior when importing a PNG into the NIIMBOT app.
- Printed result after a real phone import and physical label print.

Record the final media and import settings here after physical testing.
