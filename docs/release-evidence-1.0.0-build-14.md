# Capture This 1.0.0 (14) release evidence

Opened September 8, 2026 for the owner-requested updated TestFlight build for Luke.

- Candidate implementation: `d85bc6c046ac2085a92cd20b8d46d44661736ebc` on `codex/prepare-build-14`.
- Replacement reason: ship the committed app experience and single-label recovery improvements for testing.
- App Store Connect checked live before changing the version: latest upload/build is 13; 14 is unused.
- Baseline local verification: Flutter analysis clean; all 239 tests passed, including existing goldens. [Candidate CI](https://github.com/coltonbatts/capturethiscoffee/actions/runs/34294591283) passed.
- Bundle `com.capturethis.ctcprinter`, team `YW8K4837YB`, exact `niim_blue_flutter: 1.0.1` retained.
- Public production Supabase configuration verified: expected project host and anon key role only.
- Apple account has existing Luke access. Build 14 assignment and installation pending.
- Live Apple notice requires Account Holder acceptance of the updated Developer Program License Agreement. No acceptance performed.
- Existing App Store version is Rejected under 2.1.0 App Completeness; this is distinct from internal TestFlight availability.
- Signed archive, IPA, upload, processing and physical acceptance pending. No App Store release claimed.

## Version verification

- Changed pubspec and shared About identity together to `1.0.0 (14)`.
- Compared screenshot failures: only build digits changed in the two About-based screenshots. Updated those two baselines only; diagnostics retained locally under `output/build-14/version-golden-comparison/`.
- All 14 focused release identity/screenshot checks passed after the update. Physical-label baselines unchanged.
- Live Main internal group contains the owner and Luke; Apple reports Luke installed build 13 on September 8. No additional invitation is needed for this existing group.
