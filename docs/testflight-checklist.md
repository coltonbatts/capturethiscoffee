# TestFlight pilot checklist — Capture This

Last updated: 2026-07-15

External TestFlight is the final pilot, not the permanent distribution. The
permanent target is an approved unlisted App Store link.

## Evidence and status

| Step | Status |
|---|---|
| Bundle ID `com.capturethis.ctcprinter` and App Store record | Verified by build-4 upload history |
| Build `0.1.0 (4)` uploaded, processed, installed internally | Verified by prior audit/user evidence |
| Release version `1.0.0+5` | Implemented |
| Signed App Store IPA for `1.0.0 (5)` | Built and inspected locally |
| iPhone-only target, app/privacy manifests, permissions, licenses | Verified in build 5 IPA |
| Production `/privacy` and `/support` | Candidate implemented; live deployment pending approval |
| Stable fictional review production | Pending private operator access |
| Build 5 uploaded/processed | Pending App Store Connect credentials |
| TestFlight beta metadata | Drafted in `docs/app-store-release.md` |
| First external Beta App Review | Pending |
| Buddy invited by email | Pending owner-supplied email / approved build |
| Buddy install, link, M2_H print, and sync pilot | Pending physical hardware |

Build 4 is not the release candidate: it predates Keychain session storage,
network bounds, printer validation, interruption recovery, iPhone-only targeting,
the application privacy manifest, and the 1.0 product version.

## Before upload

1. Approve and deploy the privacy/support pages.
2. Rotate the affected temporary credential identified during the release audit.
3. Create the fictional stable fixture in
   `docs/review-production-fixture.md`; keep its token out of Git and notes.
4. Run every required verification command and the physical gate in
   `docs/physical-release-test.md`.
5. Confirm App Store name is **Capture This** and upload screenshots containing
   only fictional data.
6. Confirm build 5 is still the exact tested IPA. If any code, metadata embedded
   in the binary, or print constants change, bump the build number and rebuild.

## Build and upload

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build ipa --release
```

Output: `mobile/build/ios/ipa/ctc_printer.ipa`

Upload with Xcode Organizer or Transporter while signed into the authorized
Apple account. Apple associates it using bundle ID, version, and build number.
Wait until processing finishes and record the status in
`docs/release-evidence-1.0.0.md`.

Do not reuse build number 5 after uploading it. Change `1.0.0+5` to `+6` or
higher for any replacement binary.

## App Store Connect beta setup

1. Open **Capture This → TestFlight** and select the processed build.
2. Confirm export compliance from actual build behavior; the binary declares no
   non-exempt encryption. The account owner makes the final attestation.
3. Add the beta description, **What to Test**, feedback email, contact, privacy
   URL, and support URL from `docs/app-store-release.md`.
4. Create an external group named `Capture This crew pilot`.
5. Add build 5 and submit it for TestFlight App Review.
6. After approval, invite the buddy by email rather than a broadly shareable
   public link. Do not include the production share token in the invitation.
7. Send the fictional review URL privately and keep the fixture active.

The first external build requires Apple’s beta review. Internal-only builds
cannot be promoted to external groups; use the normal App Store/TestFlight
upload path for build 5.

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
