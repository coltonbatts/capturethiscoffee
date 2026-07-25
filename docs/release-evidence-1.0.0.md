# Capture This 1.0.0 release evidence

Last updated: 2026-07-25

This file separates verified evidence from pending claims. Update it after each
preview/production deployment, TestFlight upload, physical run, and Apple
status change.

## Source and deployment

| Item | Evidence | Status |
|---|---|---|
| GitHub repository | `https://github.com/coltonbatts/capturethiscoffee.git` | Verified |
| Starting branch/commit | `main` / `54d9f7c360978d0f0ec488ff6b27cef5c3e5526a` | Verified |
| Release branch | `codex/release-1.0.0` / `d196ff7` | Merged to `main` through PR #9 on 2026-07-20 |
| Release-candidate application source | `6003661` | Exact build-5 app source and non-shipping screenshot tooling |
| Pre-PR #10 `main` | `9cd742125447335258ca8bf16784ee791d830584` | Verified locally and on GitHub |
| PR #10 application candidate | `324d9c02aed480e09fdee21b44f1343acdb3c8ff` | Exact application, rate-limit, dependency, export, and initial handoff source; the later review-only documentation correction changes no app artifact |
| Build-6 handoff source | `da0cb8c8820c1e8e7d61ab5c1af9d70c2f2bc7fc` on `main` | Verified locally and at `origin/main` before upload; adds the in-app operating guide, Active-production print guard, and consolidated handoff hub |
| Build-7 offline-first source | `88f97dcabe7d94a31bd1fe62eae55d6ccc0e595a` on `main` | Verified locally and at `origin/main` before upload; includes on-device label rendering and durable local board caching |
| Release pull requests | [PR #9](https://github.com/coltonbatts/capturethiscoffee/pull/9) and [PR #10](https://github.com/coltonbatts/capturethiscoffee/pull/10) | PR #9 merged; PR #10 reviewed for the current candidate |
| Release tag | Proposed `capture-this-v1.0.0` after physical/external pilot pass | Pending |
| Live URL | `https://coffee.capturethis.com` | HTTPS 200 verified |
| Live Vercel deployment | `dpl_5QSYwoDepaRhT9sXcYgtL5hYtiJ3` | READY, production, verified 2026-07-24 |
| Live deployed Git commit | `e1e9ff40346ddfb606074f1927b72e171d94c546` | Latest `main`, verified through Vercel |
| Release preview deployment | `dpl_2J6VJTBb4cV79he7mJhCgyhBRqaS` / commit `dc4f33008a368feeff01b0a9817d053692ce1396` | READY |
| Release preview URL | `https://capturethiscoffee-bu7tbtneg-coltons-projects-536a670d.vercel.app` | Vercel-auth protected |
| Security/dependency candidate | PR #10 commit `324d9c02aed480e09fdee21b44f1343acdb3c8ff`, including the limiter fix and Next.js 16.2.11 | Merged and present in current production |

The live deployment contains the merged release work, later label designs,
PR #10's rate-limiter/dependency changes, and the latest documentation commit.
Root, `/privacy`, and `/support` returned 200 on 2026-07-24.

## iOS build provenance

| Item | Build 4 | Build 5 TestFlight pilot | Build 6 handoff candidate | Build 7 offline-first candidate |
|---|---|---|---|---|
| Version | `0.1.0 (4)` | `1.0.0 (5)` | `1.0.0 (6)` | `1.0.0 (7)` |
| Bundle ID | `com.capturethis.ctcprinter` | `com.capturethis.ctcprinter` | `com.capturethis.ctcprinter` | `com.capturethis.ctcprinter` |
| Display name | Capture This | Capture This | Capture This | Capture This |
| Device family | iPhone + iPad | iPhone only | iPhone only | iPhone only |
| IPA SHA-256 | `0480b56e0ed5ae495059935cf7313c31e370f9cd897827c4f99acc4c11fc936f` | Prior 2026-07-15 export: `0ba08aa4a9a502ef3907ebbf4ac367ee3d2625ed681e6001ec7f91935a389f05`; current reproducible export: `11478ace75a8b0890bc06e853e8150646221ffb095139f90d45b8dbd930f3594` | `519e26af9dcd1ad6081986d2c1f22239dfbdbbbd36c022c00c11216055ad617c` | `49b43309c95ebc8731b25c49007c8691998c14702270ae3f4b2355284073fc2c` |
| Distribution status | Uploaded, processed, internally installed (prior audit/user evidence) | Uploaded/processed in TestFlight per account-owner confirmation on 2026-07-24 | Uploaded through Xcode Organizer on 2026-07-24; processing complete, internally available, external review not submitted | Uploaded through Xcode command-line distribution on 2026-07-24; processing complete, internally available in `Main`, physical testing pending |

Build-4 evidence is preserved under the ignored local directory
`mobile/build/ios/ipa/build-4-evidence/`. File timestamps show the dirty local
brand/UI source was modified before the build-4 archive and IPA were produced,
so those brand changes are treated as part of build 4. The new security,
recovery, iPhone-only, privacy-manifest, and version changes were made afterward
and belong to build 5.

On 2026-07-23 the default Xcode export reproduced a source/archive build-5 to
IPA build-6 rewrite. `mobile/ios/ExportOptions.plist` now disables automatic
build-number management. The final rebuild verified source, archive, and IPA
all remain `1.0.0 (5)`. The account owner confirmed build 5 is now in
TestFlight. Builds 6 and 7 each received a new signed archive/IPA and retain
separate artifact evidence.

## TestFlight build 6 status

| Item | Confirmed result |
|---|---|
| Upload artifact | `mobile/build/ios/ipa/ctc_printer.ipa`, SHA-256 `519e26af9dcd1ad6081986d2c1f22239dfbdbbbd36c022c00c11216055ad617c` |
| Upload workflow/time | Xcode Organizer reported `ctc_printer 1.0.0 (6) uploaded`; App Store Connect records Jul 24, 2026 at 12:57 PM CDT |
| Processing | Build Uploads status `Complete`; binary state `Validated`; no upload warning or error was shown |
| Version/build and bundle | `1.0.0 (6)` / `com.capturethis.ctcprinter` |
| Export compliance | App Store Connect metadata: **App Uses Non-Exempt Encryption — No** |
| Device metadata | iPhone, arm64, minimum iOS 13.0 |
| Internal availability | TestFlight status `Ready to Submit`; assigned to internal group `Main` with one invite |
| Internal smoke test | Account owner installed build 6 on an iPhone, loaded holographic stock for the first time, and completed one confirmed reprint on the first attempt on 2026-07-24. Capture This controlled the printer directly over Bluetooth LE with no laptop, USB, local print station, official NIIMBOT app, or other printing bridge. Photo evidence is recorded in `docs/milestones/2026-07-24-build-6-holographic-first-print.md`; exact stock dimensions, firmware, batch, recovery, and web-sync details remain open |
| Beta metadata | Beta description, privacy URL, and build-specific **What to Test** saved from `docs/app-store-release.md` |
| External group | `Capture This crew pilot` created; 0 builds and 0 testers |
| Beta App Review | Not submitted. Required feedback email and review contact first name, last name, phone, and email are blank; the private fictional review fixture also remains pending |
| App Store Connect product name | Currently `Capture This Printer`; the signed app display name is `Capture This` |

Build 6 is now consumed and must not be reused. Any shipping-code or embedded
metadata change requires build 7 or higher.

## TestFlight build 7 status

| Item | Confirmed result |
|---|---|
| Source | `88f97dcabe7d94a31bd1fe62eae55d6ccc0e595a` on clean `main`, matching `origin/main` |
| Local artifact | `mobile/build/ios/ipa/ctc_printer.ipa`, 22,268,770 bytes, SHA-256 `49b43309c95ebc8731b25c49007c8691998c14702270ae3f4b2355284073fc2c` |
| Artifact identity | `1.0.0 (7)` / `com.capturethis.ctcprinter`; Apple Distribution signed for team `YW8K4837YB` |
| Upload workflow/time | Xcode command-line distribution reported `Upload succeeded` at Jul 24, 2026 10:13 PM CDT |
| Processing | App Store Connect Build Uploads status `Complete` |
| Internal availability | TestFlight status `Ready to Submit`; assigned to internal group `Main` with one invite |
| Automated verification | `flutter analyze` passed with no issues; `flutter test` passed 93/93; signed archive and IPA build passed |
| Physical validation | Pending build-7 iPhone/M2_H label comparison and airplane-mode cold-start print test |

Build 7 is now consumed and must not be reused. Any shipping-code or embedded
metadata change requires build 8 or higher.

## TestFlight build 8 status

App Store Connect records build 8 as uploaded on Jul 25, 2026 at 2:12 PM CDT,
processing `Complete`, TestFlight status `Ready to Submit`, and assigned to
internal group `Main` with one invite. Local archive and IPA provenance were not
recorded in this file before build 9 replaced it.

What build 8 exists to test:

| Change | What physical testing must confirm |
|---|---|
| Print deck replaces the stacked status cards | The next label is readable at arm's length on set, and the single action correctly refuses to print when disconnected, paused, or blocked by recovery |
| Label preview renders the real bitmap | What the deck shows matches the paper that comes out, for long names and long drinks |
| Print-success haptic (heavy) | Confirms a print in the hand on a set too loud to hear the printer |
| Uncertain-print haptic (double-beat) | Is distinguishable from success **without looking**; this is the state that must never be mistaken for a completed print |
| Print stamp animation | Timing reads correctly against the physical paper rather than leading or lagging it |
| Roster search and filters | Finding one person on a full call sheet is faster than scrolling |

Neither the haptics nor the stamp timing can be checked in the iOS Simulator —
it has no Bluetooth and no Taptic Engine.

Build 8 is now consumed and must not be reused.

## TestFlight build 9 status

| Item | Confirmed result |
|---|---|
| Source | Build 9 working tree based on `main` commit `7ed6f04923181fb307d48d85eee010242fbac783`; signed-in day selection and direct Supabase access were implemented locally before archive |
| Local artifact | `mobile/build/ios/ipa/ctc_printer.ipa`, 22,894,208 bytes, SHA-256 `b74965478bfbbb40863557eb8a5d8295d163e15e8ea4a68306cc8330492dd80e` |
| Artifact identity | `1.0.0 (9)` / `com.capturethis.ctcprinter`; Apple Distribution signed for team `YW8K4837YB` |
| Release configuration | Public Supabase URL and anon JWT supplied through Dart defines; no service-role marker found in the exported app |
| Upload workflow/time | Xcode command-line distribution reported `Upload succeeded` at Jul 25, 2026 3:46 PM CDT |
| Processing | App Store Connect Build Uploads status `Complete` |
| Internal availability | TestFlight status `Ready to Submit`; assigned to internal group `Main` with one invite; expires in 90 days |
| Automated verification | `flutter analyze` passed with no issues; `flutter test` passed 140/140 immediately before archive; signed archive and IPA build passed |
| Physical validation | Account owner installed the locally signed release build on an iPhone, opened a signed-in day, and successfully reprinted an existing label on the physical M2_H on 2026-07-25 |
| Remaining physical validation | Airplane-mode cold start, selected-day restoration, sign-out isolation, batch behavior, and interruption recovery remain to be recorded |

Build 9 is now consumed and must not be reused. Any shipping-code or embedded
metadata change requires build 10 or higher.

## Automated verification

| Check | Result |
|---|---|
| `npm test` | 103/103 passed |
| `npm run lint` | Passed |
| `npm run build` | Passed on Next.js 16.2.11 |
| `npm run verify:niimbot-export` | Passed; 591×354 PNG contract |
| `flutter pub get` | Passed |
| `flutter analyze` | Passed, no issues |
| `flutter test` | 27/27 passed for build-6 source, including four App Store layout regressions |
| `flutter build ipa --release --export-options-plist=ios/ExportOptions.plist` | Passed for build 6; 42.7 MB IPA, 177.6 MB archive |
| `flutter analyze` (build 7) | Passed, no issues |
| `flutter test` (build 7) | 93/93 passed, including label golden and offline cold-start coverage |
| `flutter build ipa --release --export-options-plist=ios/ExportOptions.plist` (build 7) | Passed; archive reports `1.0.0 (7)`, local IPA is 22,268,770 bytes |
| `flutter analyze` (build 9) | Passed, no issues |
| `flutter test` (build 9) | 140/140 passed, including authenticated flow, user-scoped cache, direct-board adaptation, legacy fallback, and label goldens |
| `flutter build ipa --release --export-options-plist=ios/ExportOptions.plist` with reviewed Supabase Dart defines (build 9) | Passed; archive and IPA report `1.0.0 (9)`, local IPA is 22,894,208 bytes |
| `npm audit --omit=dev` | **Failed:** three high package findings remain in Next-bundled PostCSS 8.4.31 and Sharp 0.34.5; Next.js core advisories were removed by 16.2.11 and top-level Sharp is 0.35.3 |

The build-6 IPA was inspected for version/build, bundle ID, iPhone-only device family,
portrait orientation, export-compliance flag, Bluetooth copy, application and
plugin privacy manifests, App Store distribution signing, and
`get-task-allow = false`.

The web build's 54 client artifacts contain no
`SUPABASE_SERVICE_ROLE_KEY` identifier, `service_role` marker, or service-role
JWT. The configured service-role value is not available locally and was not
copied into evidence.

Three provisional App Store PNGs are recorded under
`docs/app-store-assets/iphone-6.9/`. Each was visually inspected, is exactly
1320×2868, has no alpha channel, and contains only fictional data. A real
connected/printing image now records the first build-6 holographic reprint in
`docs/milestones/2026-07-24-build-6-holographic-first-print.md`. A complete
batch/recovery demo remains pending the full physical M2_H gate.

## Live boundary evidence

- HTTPS root returns 200.
- Signed-out operator routes redirect to login.
- Missing-token public production, label queue, PNG, and PATCH requests return
  sanitized 401 responses.
- The live Supabase Auth settings endpoint returned HTTP 200 with
  `disable_signup: true` on 2026-07-23. Public registration is disabled.
- Anonymous REST selects on all seven core tables and an anonymous `orders`
  returned HTTP 401 / Postgres `42501` using the deployed public configuration.
- Vercel reports the latest-`main` production deployment READY and no runtime
  error clusters in the inspected seven-day window as of 2026-07-24.
- Environment variable names, applied Supabase migrations, Realtime publication,
  backup settings, and a valid/revoked/expired token matrix still require
  private dashboard access or a disposable fixture.

## Release gates

| Gate | Status | Required evidence |
|---|---|---|
| Privacy/support deployment | Verified live | Both routes returned 200; owner wording approval still needs a named attestation |
| Leaked temporary credential rotation | Blocked on owner | Rotate the affected temporary Supabase/Auth credential; never reuse it |
| Public Supabase signup disabled | Verified live | Public settings reported `disable_signup: true` |
| Dependency security gate | Next.js 16.2.11 deployed; residual audit findings open | Resolve or explicitly accept the residual bundled PostCSS/Sharp findings |
| Stable fictional review production | Blocked on private operator access | Active non-expiring fixture; token stored only in App Store Connect/private handoff |
| Physical iPhone + M2_H test | Build 9 signed-in day loading and one direct-BLE reprint passed; full gate pending | Complete `docs/physical-release-test.md`, including airplane-mode cold start, exact hardware/stock, batch, recovery, sync, cold-cup adhesion, and Luke's independent run |
| App Store Connect build status | Build 9 uploaded, processing complete, internally available in `Main` | Preserve the processed build and use build 10+ for any replacement |
| External TestFlight | Group created; build not assigned and review not submitted | Supply owner-approved feedback/review contact fields and private fictional fixture, assign build 9 after its physical gate passes, submit for Beta App Review, then record Luke's pilot |
| App Review | Pending | Production submission status and reviewer correspondence |
| Unlisted request | Pending | Apple-approved Unlisted App status |
| Permanent App Store link | Pending | Direct URL verified and final clean-device print smoke test |
