# TestFlight pilot checklist — Capture This

Last updated: 2026-07-24

External TestFlight is the final pilot, not the permanent distribution. The
permanent target is an approved unlisted App Store link.

## Evidence and status

| Step | Status |
|---|---|
| Bundle ID `com.capturethis.ctcprinter` and App Store record | Verified by build-4 upload history |
| Build `0.1.0 (4)` uploaded, processed, installed internally | Verified by prior audit/user evidence |
| TestFlight pilot version `1.0.0+5` | Uploaded/processed per account-owner confirmation on 2026-07-24 |
| Signed App Store IPA for `1.0.0 (5)` | Built and inspected locally; preserved as build-5 evidence |
| iPhone-only target, app/privacy manifests, permissions, licenses | Verified in build 5 IPA |
| Next handoff source `1.0.0+6` | Implemented with in-app operating guide and Active-production print guard |
| Signed App Store IPA for `1.0.0 (6)` | Exact recorded artifact uploaded through Xcode Organizer on 2026-07-24; SHA-256 recorded in release evidence |
| Production `/privacy` and `/support` | Live; both returned 200 on 2026-07-23 |
| Stable fictional review production | Pending private operator access |
| Build 6 uploaded/processed | Upload completed at 12:57 PM CDT; App Store Connect reports processing `Complete`, binary `Validated`, and TestFlight status `Ready to Submit` |
| Build 6 internal availability | Assigned to internal group `Main`; installed on the owner's iPhone. The first confirmed reprint on newly loaded holographic stock printed on the first attempt through direct Bluetooth LE, with no laptop, USB, print station, official NIIMBOT app, or other printing bridge. Photo-backed milestone recorded on 2026-07-24 |
| TestFlight beta metadata | Beta description, privacy URL, and build-6 **What to Test** saved from `docs/app-store-release.md`; feedback email and review contact remain blank pending owner input |
| External group | `Capture This crew pilot` created with 0 testers and 0 builds; build selection is unavailable until required beta contact metadata is complete |
| First external Beta App Review | Not submitted; blocked on feedback email, first/last name, phone, email, and the private fictional review fixture |
| Buddy invited by email | Pending owner-supplied email / approved build |
| Buddy install, link, M2_H print, and sync pilot | Pending physical hardware |

Build 4 is not a release candidate: it predates Keychain session storage,
network bounds, printer validation, interruption recovery, iPhone-only targeting,
the application privacy manifest, and the 1.0 product version.

Build 6 is now the processed internal TestFlight candidate. The owner's
first-try holographic reprint proves the intended direct-Bluetooth physical
path and is preserved in
`docs/milestones/2026-07-24-build-6-holographic-first-print.md`. It remains a
smoke test, not the full physical release gate: exact stock measurements,
printer identity and firmware, batch behavior, interruption recovery, web
synchronization, cold-cup adhesion, and Luke's independent run still need the
record in `docs/physical-release-test.md`.

## Before upload

1. Record owner approval of the already-live privacy/support wording.
2. Rotate the affected temporary credential identified during the release audit.
3. Create the fictional stable fixture in
   `docs/review-production-fixture.md`; keep its token out of Git and notes.
4. Run every required verification command and the physical gate in
   `docs/physical-release-test.md`.
5. Confirm App Store name is **Capture This** and upload screenshots containing
   only fictional data.
6. Confirm source, archive, IPA, and App Store Connect all say
   `1.0.0 (7)`. If any code, embedded metadata, or print constants change after
   upload, bump to build 8 or higher and rebuild.

## Build 7 — what to test

Build 7 changes how labels are produced and how the app survives without a
signal. Both changes are verified in software only. Neither has touched real
hardware or a real dead zone, so this build is the test.

**1. The label now renders on device.** The app no longer downloads a PNG per
label; `mobile/lib/label_painter.dart` draws it. The two renderers will never be
byte-identical, so what matters is whether the physical label is right.

- Print one label and compare it against a build-6 label for the same person.
- Check the drink line specifically: a two-line drink puts its second baseline
  at y=292 with the rule at y=293, so descenders can read as a strikethrough.
  That is a design bug shared with the web renderer, not a port error.
- Check a long name (over 18 characters flips font size and baseline).
- Print on holographic stock, since that is the intended production stock.

**2. Printing no longer needs a signal.** Confirm this deliberately rather than
hoping to hit a dead zone:

- Link a production with a signal, then put the phone in airplane mode.
- Force-quit the app and relaunch. The roster should appear immediately and the
  summary line should read `Offline · synced N min ago`.
- Print a label with the printer connected over Bluetooth. This is the whole
  point of builds 6 and 7 together — it should work.
- Leave it offline past ten minutes and confirm the "Working offline" banner
  appears.
- Turn the signal back on and confirm the banner clears and the line reads
  `Synced HH:MM:SS`.

**Known gap to expect, not report:** if the coordinator marks the production
**complete** while the app is open, the board 404s and the app says "Working
offline" over a finished day. The error banner underneath tells the truth. That
is recorded and belongs with the Phase D work.

## Build and upload

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

Output: `mobile/build/ios/ipa/ctc_printer.ipa`

Upload with Xcode Organizer or Transporter while signed into the authorized
Apple account. Apple associates it using bundle ID, version, and build number.
Wait until processing finishes and record the status in
`docs/release-evidence-1.0.0.md`.

Do not reuse build number 6. It was uploaded on 2026-07-24; change `1.0.0+6`
to `+7` or higher for any replacement binary.

The checked-in export options set `manageAppVersionAndBuildNumber` to false.
This is intentional: Xcode must not silently rewrite the exported IPA to a
different build number than the archive and `pubspec.yaml`. The 2026-07-23
verification reproduced that rewrite with the default export and then verified
archive/IPA agreement when the checked-in export options were used.

## App Store Connect beta setup

1. Open **Capture This → TestFlight** and select the processed build.
2. Confirm export compliance from actual build behavior; the binary declares no
   non-exempt encryption. The account owner makes the final attestation.
3. Add the beta description, **What to Test**, feedback email, contact, privacy
   URL, and support URL from `docs/app-store-release.md`.
4. Create an external group named `Capture This crew pilot`.
5. Add build 6 and submit it for TestFlight App Review.
6. After approval, invite the buddy by email rather than a broadly shareable
   public link. Do not include the production share token in the invitation.
7. Send the fictional review URL privately and keep the fixture active.

The first external build requires Apple’s beta review. Internal-only builds
cannot be promoted to external groups; use the normal App Store/TestFlight
upload path for build 6.

## Buddy pilot acceptance

Record:

- Tester / date: _____
- Invitation accepted and build installed: _____
- iPhone / iOS / build: _____
- Production linked: pass/fail _____
- Exact M2_H / firmware / stock: _____
- Short/long/batch labels: pass/fail _____
- Interrupted print recovery: pass/fail _____
- Successful prints synced to hosted web app: pass/fail _____
- Feedback/crash report: _____
- Release-blocking issue: none / describe _____

The pilot passes only after the buddy completes install → link → connect →
physical print → sync, and the physical release record is complete. Fix a
release blocker, upload a new build, and repeat the affected test. Do not treat
TestFlight approval alone as product approval.

## Troubleshooting

| Problem | Action |
|---|---|
| Build not visible | Wait for processing; verify bundle ID/version/build and upload role |
| Build marked Internal Only | Upload a normal App Store/TestFlight build with a new number |
| API fails | Use the active HTTPS fictional production; never LAN/localhost for testers |
| Multiple printers found | Power off every NIIMBOT except the tested M2_H and retry |
| Physical print succeeded but sync failed | Use **Sync only**; do not reprint |
| Print outcome uncertain | Inspect physical output, then select the matching recovery action |
| Privacy URL fails | Stop pilot; deploy/verify `/privacy` before Beta App Review |
