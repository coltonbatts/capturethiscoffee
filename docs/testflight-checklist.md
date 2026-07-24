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
| Build 6 internal availability | Assigned to internal group `Main`; installed on the owner's iPhone and one label printed successfully per owner report on 2026-07-24 |
| TestFlight beta metadata | Beta description, privacy URL, and build-6 **What to Test** saved from `docs/app-store-release.md`; feedback email and review contact remain blank pending owner input |
| External group | `Capture This crew pilot` created with 0 testers and 0 builds; build selection is unavailable until required beta contact metadata is complete |
| First external Beta App Review | Not submitted; blocked on feedback email, first/last name, phone, email, and the private fictional review fixture |
| Buddy invited by email | Pending owner-supplied email / approved build |
| Buddy install, link, M2_H print, and sync pilot | Pending physical hardware |

Build 4 is not a release candidate: it predates Keychain session storage,
network bounds, printer validation, interruption recovery, iPhone-only targeting,
the application privacy manifest, and the 1.0 product version.

Build 6 is now the processed internal TestFlight candidate. The owner's
installation and one successful label are a smoke test, not the full physical
release gate: printer identity, firmware, stock, batch behavior, interruption
recovery, web synchronization, and Luke's independent run still need the
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
   `1.0.0 (6)`. If any code, embedded metadata, or print constants change after
   upload, bump to build 7 or higher and rebuild.

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
