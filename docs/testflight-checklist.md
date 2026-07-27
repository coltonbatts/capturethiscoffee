# TestFlight pilot checklist — Capture This

Last updated: 2026-07-27 18:42 CDT

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
| Production `/privacy` and `/support` | Live; both returned 200 again at 17:22 CDT on 2026-07-27 and visibly identified Capture This plus `info@capturethis.com`; owner wording approval remains open |
| Stable fictional review production | Pending private operator access |
| Build 6 uploaded/processed | Upload completed at 12:57 PM CDT; App Store Connect reports processing `Complete`, binary `Validated`, and TestFlight status `Ready to Submit` |
| Build 6 internal availability | Assigned to internal group `Main`; installed on the owner's iPhone. The first confirmed reprint on newly loaded holographic stock printed on the first attempt through direct Bluetooth LE, with no laptop, USB, print station, official NIIMBOT app, or other printing bridge. Photo-backed milestone recorded on 2026-07-24 |
| Signed App Store IPA for `1.0.0 (7)` | Built from clean `main` at `88f97dc`; version/build, bundle ID, distribution signing, and artifact hash verified locally |
| Build 7 uploaded/processed | Uploaded at 10:13 PM CDT on 2026-07-24; App Store Connect reports upload `Complete` and TestFlight status `Ready to Submit` |
| Build 7 internal availability | Assigned to internal group `Main` with one invite; iPhone/M2_H and airplane-mode validation pending |
| Build 8 uploaded/processed | App Store Connect records upload at 2:12 PM CDT on 2026-07-25; processing `Complete`, status `Ready to Submit`, assigned to `Main` |
| Build 9 signed App Store IPA | `1.0.0 (9)`, 22,894,208 bytes, SHA-256 `b74965478bfbbb40863557eb8a5d8295d163e15e8ea4a68306cc8330492dd80e` |
| Build 9 committed source | `47c4405` (`Ship Build 9 signed-in day selection`) |
| Build 9 uploaded/processed | Uploaded at 3:46 PM CDT on 2026-07-25; App Store Connect reports upload `Complete` and TestFlight status `Ready to Submit` |
| Build 9 internal availability | Assigned to internal group `Main` with one invite; locally signed release launch, signed-in day loading, and one physical M2_H reprint passed |
| Build 10 source and backend | `1.0.0 (10)` app code committed at `fea2fc3`; clean archive source `ab5edb8` matches `origin/main`. Flutter 158/158 and analysis pass. Production monotonic printed-fact trigger is applied and verified; production Realtime publication membership remains unverified, with polling/resume/manual fallbacks retained |
| Build 10 signed App Store IPA | `1.0.0 (10)`, 23,128,931 bytes, SHA-256 `7a578953a32c5437f082392141b06559bce81eaab7252657ee9aa2366e9e30b7`; production host present, disposable host absent, public `anon` key only, Apple Distribution signed, `get-task-allow = false` |
| Build 10 upload/processing | Xcode command-line upload succeeded at 4:24 PM CDT on 2026-07-27. At 4:26 PM Apple/TestFlight emailed that `Capture This Printer 1.0.0 (10) for iOS is now available to test` for the existing internal tester |
| TestFlight beta metadata | Owner approved the exact Build 10 beta description, What to Test, review notes, demo instructions, hardware explanation, and export-compliance draft at 18:42 CDT on 2026-07-27. Feedback email, review contact, separate privacy/support approval, secure production fixture, and submission approval remain open |
| External group | `Capture This crew pilot` created with 0 testers and 0 builds; build selection is unavailable until required beta contact metadata is complete |
| First external Beta App Review | Not submitted; blocked on feedback email, first/last name, phone, email, and the private fictional review fixture |
| Build 10 expiration | **Pending authoritative App Store Connect value.** Expected around 2026-10-25, but do not use the estimate as the handoff record |
| Buddy invited by email | Pending owner-supplied email / approved build |
| Buddy install, sign-in, day selection, M2_H print, and sync pilot | Pending physical hardware |

Build 4 is not a release candidate: it predates Keychain session storage,
network bounds, printer validation, interruption recovery, iPhone-only targeting,
the application privacy manifest, and the 1.0 product version.

Build 10 is the current internal TestFlight candidate. Build 6's first-try
holographic reprint and Build 9's signed-in direct-Supabase reprint
prove the intended direct-Bluetooth path. Both remain smoke tests, not Build
10 physical acceptance. Build 9 checks 1, 2, 5, 6, and 9 physically passed;
Gate 3 failed with the accepted single-label limitation; checks 4, 7, 8, and
10 plus the complete Build 10 run remain open in
`docs/physical-release-test.md`.

Historical validation note: the preserved Build 9 IPA embeds the production
Supabase host, so an isolated `47c4405` bundle was used for the disposable
Build 9 baseline. Do not use either Build 9 target for current Build 10
acceptance. Use the exact TestFlight `1.0.0 (10)` with the separately approved
fictional account and Active day in the production backend.

**Unattended batch printing is not a supported capability.** The ten-label batch
check failed twice on 2026-07-27, each time on the batch's own first label, with
a printer acknowledgement timeout. The owner accepted single-label printing as
the supported operating mode. Any TestFlight **What to Test** copy, beta
description, or tester instruction must say "print labels one at a time" and must
not ask a tester to exercise **Print all**. Full diagnosis is in
`docs/build-10-release-validation-2026-07-25.md`.

On 2026-07-27 the owner explicitly authorized packaging and uploading Build 10
to obtain its first device time through internal TestFlight. That upload does
not close the remaining physical gates. Build 10 still needs the physical
seven-step acceptance in `docs/build-10-implementation-2026-07-25.md`; the
exact ten-row audit and combined operator worksheet are in
`docs/build-10-release-validation-2026-07-25.md`.

## Build 10 external-TestFlight preflight

The binary is already uploaded. Do not upload another binary during this
workflow unless Build 10 is marked Internal Only, Apple requires a binary
change, or an approved release-blocking fix is necessary.

1. Obtain owner approval for the exact Build 10 beta copy and missing fields in
   `docs/build-10-external-testflight-metadata-2026-07-27.md`.
2. Obtain explicit approval before creating the owner-provisioned fictional
   account and Active production specified in
   `docs/review-production-fixture.md`.
3. Keep credentials only in App Store Connect secure Test Information fields
   or another explicitly approved secure channel.
4. Confirm Build 10 is not marked **TestFlight Internal Only**.
5. Complete Test Information, add Build 10 to `Capture This crew pilot`, and
   submit only after the owner explicitly approves the external write.
6. Record Apple's authoritative expiration and review status.
7. Do not invite the buddy until Apple approves Build 10 for external testing.

## Build 10 — internal TestFlight device acceptance

Use the numbered physical worksheet in
`docs/build-10-pilot-handoff-2026-07-27.md`. It covers the exact TestFlight
identity; online and airplane-mode restoration; three offline captures; at
least two individual prints; relaunch; exactly-once replay; both conflict
choices; Planning/Complete refusal; haptics; Reduce Motion; deliberate
single-label interruption; reconnect; background/resume; Legacy and `/labels`
fallback; Realtime/fallback observation; and sanitized evidence.

## Historical Build 9 baseline — do not send as current What to Test

- Fresh install → owner-provisioned sign-in → Days → select an Active day.
- Confirm the selected direct-Supabase board drives the roster and print deck.
- Force-quit and relaunch; confirm the account and selected day restore.
- After an online load, cold-launch in airplane mode; confirm the cached day
  opens, staleness is visible, and the M2_H remains printable.
- Restore connectivity and confirm printed status synchronizes without a
  duplicate physical label.
- Sign out and confirm another account cannot see the prior account's cached
  board or unresolved recovery details.
- Confirm **Legacy link** still opens a Build 8 production share link.
- Preserve the recorded batch failure and uncertain-print evidence. Do not ask
  another tester to use **Print all** as an acceptance requirement.

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

Do not reuse build numbers 9 or 10. If a replacement binary is genuinely
required, stop and document why Build 11 is necessary before changing
`mobile/pubspec.yaml` or packaging anything.

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
   URL, support URL, review notes, and secure demo instructions from
   `docs/build-10-external-testflight-metadata-2026-07-27.md`.
4. Use the existing external group `Capture This crew pilot`.
5. Add Build 10 and submit it for TestFlight App Review only after the owner
   explicitly approves the final packet and submission.
6. After approval, invite the buddy by email rather than a broadly shareable
   public link. Do not include the production share token in the invitation.
7. Send the fictional review URL privately and keep the fixture active.

The first external build requires Apple’s beta review. Internal-only builds
cannot be promoted to external groups; use the normal App Store/TestFlight
upload path for the physical-test candidate.

## Buddy pilot acceptance

Record:

- Tester / date: _____
- Invitation accepted and build installed: _____
- iPhone / iOS / build: _____
- Account sign-in and Active day selected: pass/fail _____
- Legacy-link fallback: pass/fail _____
- Exact M2_H / firmware / stock: _____
- Short/long labels printed sequentially, one at a time: pass/fail _____
- Interrupted print recovery: pass/fail _____
- Retry versus sync-only decision explained correctly: pass/fail _____
- Power-cycle/reconnect and background/resume: pass/fail _____
- Successful prints synced to Supabase/hosted board: pass/fail _____
- TestFlight expiration: _____
- Feedback/crash report: _____
- Release-blocking issue: none / describe _____

The pilot passes only after the buddy completes install → sign in → select day → connect →
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
