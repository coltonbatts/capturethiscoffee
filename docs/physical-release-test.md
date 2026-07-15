# Capture This physical release gate

Run this only with the signed release-candidate build on a real iPhone and the
actual NIIMBOT M2_H/stock. Hardware support is not passed by simulator, mock,
PNG, or archive evidence.

## Record first

- Date/tester: _____
- Capture This version/build: _____
- iPhone model / iOS: _____
- Printer model shown on label/device: _____
- Printer firmware (do not update it): _____
- Stock brand/type/finish: _____
- Measured label width × height: _____ mm × _____ mm
- Die-cut or continuous: _____
- App density: _____
- Fictional/disposable production used: _____

## Guided test

1. Confirm the exact printer is **NIIMBOT M2_H** and record its firmware.
2. Measure and record the actual label-roll dimensions and stock type.
3. Force-quit the official NIIMBOT app on every nearby phone/tablet.
4. Open build 5 and link the supplied disposable active-production HTTPS URL.
5. Power off other nearby NIIMBOT printers, connect the one M2_H, and confirm
   the app does not accept another model.
6. Print a short name/drink, a long name, a long drink, one confirmed reprint,
   and a batch of at least 10 labels.
7. For every sample, inspect orientation, cropping, density, alignment, name
   hierarchy, drink readability, feed gaps, and label-to-order correctness.
8. Confirm every successful physical print changes the hosted web order to
   printed.
9. During a second batch, interrupt Bluetooth. For the affected label, inspect
   the physical printer before choosing either **Label printed — sync only** or
   **Nothing printed — retry**. Confirm no accidental duplicate.
10. Power-cycle the printer, reconnect, refresh, and print one more label.
11. Background the app, resume it, reconnect when prompted, and print one more
    label.
12. Apply one label to a cold cup for at least five minutes, then inspect
    adhesion, lifting, smearing, fading, and readability.
13. Photograph representative short/long labels and the cold-cup result without
    exposing a production token or real personal data.

## Result

- Short label: pass/fail + notes _____
- Long name: pass/fail + notes _____
- Long drink: pass/fail + notes _____
- Confirmed reprint: pass/fail + notes _____
- 10+ batch count / successes: _____ / _____
- Interrupted label physically printed? _____
- Recovery choice/result: _____
- Every physical success synced to web? _____
- Power-cycle/reconnect: pass/fail _____
- Background/resume: pass/fail _____
- Cold cup after five minutes: pass/fail _____
- Orientation/cropping/density/alignment/readability: _____
- Release-blocking issue: none / describe _____

The gate passes only when the tester reports the exact record above, all label
types are usable, successful prints synchronize, interruption recovery avoids
duplicates, and the stock survives the cold-cup check. If tuning changes print
width, density, or the server preset, increment the iOS build, rerun automated
verification, and repeat the smallest affected physical cases.
