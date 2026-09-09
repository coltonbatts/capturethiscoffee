# Capture This 1.0.0 (14) release evidence

Opened September 8, 2026 for the owner-requested updated TestFlight build for Luke.

- Candidate implementation: `d85bc6c046ac2085a92cd20b8d46d44661736ebc` on `codex/prepare-build-14`.
- Replacement reason: ship the committed app experience and single-label recovery improvements for testing.
- App Store Connect checked live before changing the version: latest upload/build is 13; 14 is unused.
- Baseline local verification: Flutter analysis clean; all 239 tests passed, including existing goldens. [Candidate CI](https://github.com/coltonbatts/capturethiscoffee/actions/runs/34294591283) passed.
- Bundle `com.capturethis.ctcprinter`, team `YW8K4837YB`, exact `niim_blue_flutter: 1.0.1` retained.
- Public production Supabase configuration verified: expected project host and anon key role only.
- Apple account has existing Luke access. Build 14 assignment is confirmed; Luke's installation is pending device evidence.
- Live Apple notice requires Account Holder acceptance of the updated Developer Program License Agreement. No acceptance performed.
- Existing App Store version is Rejected under 2.1.0 App Completeness; this is distinct from internal TestFlight availability.
- Physical acceptance remains pending. No App Store release claimed.

## Version verification

- Changed pubspec and shared About identity together to `1.0.0 (14)`.
- Compared screenshot failures: only build digits changed in the two About-based screenshots. Updated those two baselines only; diagnostics retained locally under `output/build-14/version-golden-comparison/`.
- All 14 focused release identity/screenshot checks passed after the update. Physical-label baselines unchanged.
- Live Main internal group contains the owner and Luke; Apple reports Luke installed build 13 on September 8. No additional invitation is needed for this existing group.

## Signed candidate

- Version commit: `3363d9b`; source files match archive input. Pushed to `codex/prepare-build-14`. Not merged to main.
- `flutter build ipa --release --no-pub` with reviewed public production defines and checked-in export options passed. Archive and exported IPA both identify `1.0.0 (14)` / `com.capturethis.ctcprinter`.
- IPA: `mobile/build/ios/ipa/ctc_printer.ipa`, 23,641,222 bytes; SHA-256 `515c88540f6e678f8670555273ae867a7fb3a0db87a5e3281efd2881ee99df09`.
- Apple Distribution signature, expected team, App Store provisioning, `get-task-allow=false`, non-exempt encryption false verified. Production host is embedded; the only embedded JWT role is `anon`.
- Upload completed at 19:35 CDT on September 8. App Store Connect build ID `8376109a-324a-43a6-8f82-360e7fa6ee5b` is Complete, Ready to Submit, expires in 90 days, and is assigned to the internal `Main` group (two testers: Colton and Luke). It has no installs, sessions, crashes, or feedback yet.
