# Capture This physical release gate

Run this only with the signed release-candidate build on a real iPhone and the
actual NIIMBOT M2_H/stock. Hardware support is not passed by simulator, mock,
PNG, or archive evidence.

## Partial milestone recorded — July 24, 2026

The account owner installed iOS build 6, loaded the holographic stock for the
first time, and completed one confirmed reprint on the first attempt. Capture
This controlled the printer directly over Bluetooth LE, with no laptop, USB
connection, local print station, official NIIMBOT app, or other printing
bridge. The supplied photo shows a legible, aligned holographic label at the
printer.

Photo and full milestone:
[`milestones/2026-07-24-build-6-holographic-first-print.md`](milestones/2026-07-24-build-6-holographic-first-print.md).

This records the single-reprint result below as a partial pass. Do not mark the
entire release gate passed until the remaining record, batch, synchronization,
recovery, adhesion, and independent-operator checks are complete.

## Record first

- Date/tester: _____
- Luke present as accepting operator: yes/no _____
- Capture This version/build: _____
- iPhone model / iOS: _____
- Printer model shown on label/device: _____
- Printer serial / asset identifier: _____
- Printer firmware (do not update it): _____
- Ribbon brand/type/color and lot if available: _____
- Stock brand/type/finish: _____
- Measured label width × height: _____ mm × _____ mm
- Shape and feed: rectangle/round/other _____; die-cut/continuous _____
- App density: _____
- Fictional/disposable production used: _____
- Disposable link issued by / revocation owner: _____ / _____

## Guided test

1. Confirm the exact printer is **NIIMBOT M2_H** and record its firmware.
2. Measure and record the actual label-roll dimensions and stock type.
3. Force-quit the official NIIMBOT app on every nearby phone/tablet.
4. Open the version/build recorded above and link the supplied disposable
   active-production HTTPS URL.
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
14. Have Luke repeat link → connect → print → web-sync → interrupted recovery
    → fallback himself, without Colton touching the phone or dashboard.

## Result

- Short label: pass/fail + notes _____
- Long name: pass/fail + notes _____
- Long drink: pass/fail + notes _____
- Confirmed reprint: pass/fail + notes _____
- 10+ batch count / successes: _____ / _____
- Label-to-order correctness for the entire batch: pass/fail + notes _____
- Interrupted label physically printed? _____
- Recovery choice/result: _____
- Every physical success synced to web? _____
- Power-cycle/reconnect: pass/fail _____
- Background/resume: pass/fail _____
- Cold cup after five minutes: pass/fail _____
- Orientation/cropping/density/alignment/readability: _____
- Feed gaps / skipped stock / ribbon behavior: _____
- Representative fictional-data photo filenames/location: _____
- Luke independent end-to-end pilot: pass/fail + notes _____
- Release-blocking issue: none / describe _____

## Acceptance and release

- Final supported Capture This version/build: _____
- Final accepted printer asset/serial: _____
- Final firmware (record only; do not update): _____
- Final ribbon and reorder reference: _____
- Final stock, dimensions, shape, and reorder reference: _____
- Disposable production link revoked after evidence capture: yes/no _____
- Evidence contains no real client data or visible token: yes/no _____
- Open limitations accepted: _____
- Luke accepts day-of operation: name/signature/date _____
- Account/release owner accepts platform obligations: name/signature/date _____
- Printer may leave Colton's possession: yes/no _____

The gate passes only when the tester reports the exact record above, all label
types are usable, successful prints synchronize, interruption recovery avoids
duplicates, Luke completes the flow independently, and the stock survives the
cold-cup check. If tuning changes print
width, density, or the server preset, increment the iOS build, rerun automated
verification, and repeat the smallest affected physical cases.
