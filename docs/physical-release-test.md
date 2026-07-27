# Capture This physical release gate

Run this only with the signed release-candidate build on a real iPhone and the
actual NIIMBOT M2_H/stock. Hardware support is not passed by simulator, mock,
PNG, or archive evidence.

## Partial milestones recorded — July 24-25, 2026

The account owner installed iOS build 6, loaded the holographic stock for the
first time, and completed one confirmed reprint on the first attempt. Capture
This controlled the printer directly over Bluetooth LE, with no laptop, USB
connection, local print station, official NIIMBOT app, or other printing
bridge. The supplied photo shows a legible, aligned holographic label at the
printer.

Photo and full milestone:
[`milestones/2026-07-24-build-6-holographic-first-print.md`](milestones/2026-07-24-build-6-holographic-first-print.md).

On July 25, the account owner also installed a signed Build 9 release, signed
in, selected an existing day through direct Supabase access, and completed one
physical M2_H reprint.

These record the single-reprint path as a partial pass. Do not mark the entire
release gate passed until authenticated offline restoration, account isolation,
the remaining hardware record, batch, synchronization, recovery, adhesion, and
independent-operator checks are complete.

## Build 9 exit audit — 2026-07-25 18:53 CDT

The initial release-validation audit found all ten named exit checks open.
During the direct physical session on 2026-07-27, checks 1, 2, 5, 6, and 9
passed: authenticated and airplane-mode cold starts restored correctly,
printed-but-unsynced recovery synced without a duplicate, Account A's durable
recovery did not leak into Account B and returned only to Account A, and a
fictional label remained clean and readable on a cold cup.

**Check 3, the unattended ten-label batch, failed on 2026-07-27.** Two
`Print all` runs each stopped on the batch's own first label with a printer
acknowledgement timeout — Operator 01 awaiting `0x04 inPageStart` (no paper) and
Operator 02 awaiting `0xe4 inPageEnd` (one label emerged). Three of five physical
print attempts in the campaign ended uncertain, while every single-label print
attempted after a resolved recovery succeeded. The app behaved correctly
throughout: it recorded uncertainty before the packet, stopped at the failing
label, tore down BLE, and never advanced. Root cause was not isolated. The owner
accepted **single-label printing as the supported operating mode** and recorded
unattended batch printing as a documented product limitation. Step 6's "batch of
at least 10 labels" therefore cannot currently be satisfied and must not be
reported as satisfied.

Checks 4, 7, 8, and 10 remain open; no physical pass is inferred for them.

The exact per-check evidence gap, shortest combined session, Build 10
seven-step acceptance, and timestamped result fields are maintained in
[`build-10-release-validation-2026-07-25.md`](build-10-release-validation-2026-07-25.md).
Do not mark a row passed from automated coverage.

The preserved Build 9 IPA was inspected on 2026-07-27 and contains the
production Supabase hostname. It is provenance evidence, not an authorized
acceptance target. Do not perform these fictional writes with that IPA. Run
exact Build 9 source `47c4405` on the iPhone in release mode with the explicitly
authorized disposable project's public URL/key, without creating an archive or
IPA, and confirm that only fictional disposable data is visible before
continuing.

The safe detached `47c4405` source passed Flutter analysis plus 140/140 tests
with `niim_blue_flutter: 1.0.1`. Its disposable-host-only release build is
installed directly in isolated bundle
`com.capturethis.ctcprinter.build10validation`; no archive, IPA export, or
upload was created. Disposable fixture `build10-20260727-a` contains separate
batch, recovery, Build 10 acceptance, Planning, and Complete days. Following a
no-paper interruption and verified single-label retry, one fresh fictional
replacement row restored exactly ten unprinted batch labels. Both test accounts
can read the fixture. Preserve it until the physical evidence queries finish.

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
- Disposable invited account issued by / cleanup owner: _____ / _____
- Disposable link issued by / revocation owner: _____ / _____

## Guided test

1. Confirm the exact printer is **NIIMBOT M2_H** and record its firmware.
2. Measure and record the actual label-roll dimensions and stock type.
3. Force-quit the official NIIMBOT app on every nearby phone/tablet.
4. Open the version/build recorded above, sign in with the disposable invited
   account, and select the supplied fictional Active day.
5. Power off other nearby NIIMBOT printers, connect the one M2_H, and confirm
   the app does not accept another model.
6. Print a short name/drink, a long name, a long drink, one confirmed reprint,
   and a batch of at least 10 labels.
7. For every sample, inspect orientation, cropping, density, alignment, name
   hierarchy, drink readability, feed gaps, and label-to-order correctness.
8. Confirm every successful physical print changes the Supabase order and
   hosted web board to printed.
9. During a second batch, interrupt Bluetooth. For the affected label, inspect
   the physical printer before choosing either **Label printed — sync only** or
   **Nothing printed — retry**. Confirm no accidental duplicate.
10. Power-cycle the printer, reconnect, refresh, and print one more label.
11. Background the app, resume it, reconnect when prompted, and print one more
    label.
12. Apply one label to a cold cup for at least five minutes, then inspect
    adhesion, lifting, smearing, fading, and readability.
13. After one successful online load, force-quit, enable airplane mode,
    relaunch, and confirm the same account/day/board restore and remain
    printable. Restore signal and confirm pending printed status synchronizes
    without a duplicate.
14. Sign out, sign into a second disposable account, and confirm the first
    account's selected day, cached board, and recovery details are not visible.
15. Mark or select a Planning/Complete day and confirm new physical printing is
    refused.
16. Exercise **Advanced · Legacy link** with a disposable share URL, then
    complete one `/labels` fallback drill.
17. Photograph representative short/long labels and the cold-cup result without
    exposing a production token or real personal data.
18. Have Luke repeat sign in → select day → connect → print → hosted sync →
    airplane-mode restore → interrupted recovery → fallback himself, without
    Colton touching the phone or dashboard.

## Result

- Short label: pass/fail + notes _____
- Long name: pass/fail + notes _____
- Long drink: pass/fail + notes _____
- Confirmed reprint: pass/fail + notes _____
- 10+ batch count / successes: _____ / _____
- Label-to-order correctness for the entire batch: pass/fail + notes _____
- Interrupted label physically printed? _____
- Recovery choice/result: _____
- Every physical success synced to Supabase/hosted board? _____
- Power-cycle/reconnect: pass/fail _____
- Background/resume: pass/fail _____
- Authenticated airplane-mode cold start: pass/fail _____
- Pending printed-state replay without duplicate: pass/fail _____
- Sign-out/second-account isolation: pass/fail _____
- Planning/complete-day refusal: pass/fail _____
- Legacy-link and `/labels` fallback: pass/fail _____
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
- Disposable invited account removed/disabled: yes/no _____
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
