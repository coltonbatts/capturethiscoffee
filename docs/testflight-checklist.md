# TestFlight pilot checklist — Capture This

Last updated: 2026-07-27

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
| Signed App Store IPA for `1.0.0 (7)` | Built from clean `main` at `88f97dc`; version/build, bundle ID, distribution signing, and artifact hash verified locally |
| Build 7 uploaded/processed | Uploaded at 10:13 PM CDT on 2026-07-24; App Store Connect reports upload `Complete` and TestFlight status `Ready to Submit` |
| Build 7 internal availability | Assigned to internal group `Main` with one invite; iPhone/M2_H and airplane-mode validation pending |
| Build 8 uploaded/processed | App Store Connect records upload at 2:12 PM CDT on 2026-07-25; processing `Complete`, status `Ready to Submit`, assigned to `Main` |
| Build 9 signed App Store IPA | `1.0.0 (9)`, 22,894,208 bytes, SHA-256 `b74965478bfbbb40863557eb8a5d8295d163e15e8ea4a68306cc8330492dd80e` |
| Build 9 committed source | `47c4405` (`Ship Build 9 signed-in day selection`) |
| Build 9 uploaded/processed | Uploaded at 3:46 PM CDT on 2026-07-25; App Store Connect reports upload `Complete` and TestFlight status `Ready to Submit` |
| Build 9 internal availability | Assigned to internal group `Main` with one invite; locally signed release launch, signed-in day loading, and one physical M2_H reprint passed |
| Build 10 local implementation | `1.0.0 (10)` committed and pushed at `fea2fc3`; Flutter 158/158, frozen-web 105/105 plus warning-free lint/build/geometry, and clean disposable local-Supabase verification pass. Build 10 migrations are applied only in authorized disposable project `svqxznvyrbmbqihekkwo`. Ledger/schema/RLS/publication, anonymous refusal, two-user authenticated RLS/CAS/conflict/printed-fact/Realtime, and transient cleanup all pass. Fictional physical fixture `build10-20260727-a` is seeded and readable by both users. Final post-tool regressions passed before 12:20 CDT on 2026-07-27. No archive, upload, or production migration |
| TestFlight beta metadata | Beta description, privacy URL, and build-6 **What to Test** saved from `docs/app-store-release.md`; feedback email and review contact remain blank pending owner input |
| External group | `Capture This crew pilot` created with 0 testers and 0 builds; build selection is unavailable until required beta contact metadata is complete |
| First external Beta App Review | Not submitted; blocked on feedback email, first/last name, phone, email, and the private fictional review fixture |
| Buddy invited by email | Pending owner-supplied email / approved build |
| Buddy install, sign-in, day selection, M2_H print, and sync pilot | Pending physical hardware |

Build 4 is not a release candidate: it predates Keychain session storage,
network bounds, printer validation, interruption recovery, iPhone-only targeting,
the application privacy manifest, and the 1.0 product version.

Build 9 is the current processed internal TestFlight candidate. Build 6's
first-try holographic reprint and Build 9's signed-in direct-Supabase reprint
prove the intended direct-Bluetooth path. Both remain smoke tests, not the full
physical release gate: authenticated airplane-mode restoration, exact stock
measurements, printer identity and firmware, batch behavior, interruption
recovery, synchronization, cold-cup adhesion, and Luke's independent run still
need the record in `docs/physical-release-test.md`.

The preserved Build 9 IPA embeds the production Supabase host and must not be
used for fictional acceptance writes. Run exact source `47c4405` in release
mode on the physical iPhone with the explicitly authorized disposable public
URL/key; do not archive, export, or upload that validation install.

Build 10 must not be packaged or uploaded until that Build 9 gate is complete.
Afterward it also needs the physical seven-step acceptance in
`docs/build-10-implementation-2026-07-25.md` against a disposable fixture.
The exact ten-row audit and combined operator worksheet are in
`docs/build-10-release-validation-2026-07-25.md`.

## Before upload

1. Record owner approval of the already-live privacy/support wording.
2. Rotate the affected temporary credential identified during the release audit.
3. Create the fictional stable fixture in
   `docs/review-production-fixture.md`; keep its token out of Git and notes.
4. Run every required verification command and the physical gate in
   `docs/physical-release-test.md`.
5. Confirm App Store name is **Capture This** and upload screenshots containing
   only fictional data.
6. For a future Build 10 upload, confirm source, archive, IPA, and App Store
   Connect all say `1.0.0 (10)`. Do not create that archive until the Build 9
   physical exit gate and Build 10 disposable-fixture acceptance are recorded.

## Build 10 — what to test after the packaging gate opens

- Load one existing Active production while online.
- Enable airplane mode, force-quit, and cold-start from the authenticated cache.
- Capture at least three orders; verify Collect progress and Print update
  immediately.
- Print at least two labels on the accepted M2_H and stock.
- Force-quit with all mutations still pending, then relaunch offline.
- Restore connectivity and verify every ordinary field and both monotonic
  printed facts in Supabase, with no replay on a second refresh.
- Make a competing edit from the frozen web/server surface and verify the phone
  displays the local and server versions, stops, and requires an explicit
  resolution.
- Verify planning/complete days retain pending work but refuse replay and
  physical printing.
- Verify **Legacy link** remains functional.

## Build 9 — what to test

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
- Exercise batch stop/recovery and uncertain-print resolution on the real M2_H.

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

Do not reuse build number 9. It was uploaded on 2026-07-25; use `1.0.0+10` or
higher for any replacement binary.

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
5. After its physical gate passes, add build 9 and submit it for TestFlight App
   Review.
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
- Short/long/batch labels: pass/fail _____
- Interrupted print recovery: pass/fail _____
- Successful prints synced to Supabase/hosted board: pass/fail _____
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
