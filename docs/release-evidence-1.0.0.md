# Capture This 1.0.0 release evidence

Last updated: 2026-07-15

This file separates verified evidence from pending claims. Update it after each
preview/production deployment, TestFlight upload, physical run, and Apple
status change.

## Source and deployment

| Item | Evidence | Status |
|---|---|---|
| GitHub repository | `https://github.com/coltonbatts/capturethiscoffee.git` | Verified |
| Starting branch/commit | `main` / `54d9f7c360978d0f0ec488ff6b27cef5c3e5526a` | Verified |
| Release branch | `codex/release-1.0.0` | Created |
| Release-candidate application source | `6003661` | Exact build-5 app source and non-shipping screenshot tooling |
| Draft pull request | `https://github.com/coltonbatts/capturethiscoffee/pull/9` | OPEN, DRAFT, mergeable; production merge gated |
| Release tag | Proposed `capture-this-v1.0.0` after physical/external pilot pass | Pending |
| Live URL | `https://coffee.capturethis.com` | HTTPS 200 verified |
| Live Vercel deployment | `dpl_2mj6VSDnPRCJ4vCfSzHM4XsLmk64` | READY |
| Live deployed Git commit | `54d9f7c360978d0f0ec488ff6b27cef5c3e5526a` | Verified through Vercel |
| Release preview deployment | `dpl_2J6VJTBb4cV79he7mJhCgyhBRqaS` / commit `dc4f33008a368feeff01b0a9817d053692ce1396` | READY |
| Release preview URL | `https://capturethiscoffee-bu7tbtneg-coltons-projects-536a670d.vercel.app` | Vercel-auth protected |
| Production release deploy | Must match approved release commit | Pending |

The live deployment predates the current release candidate. Its `/privacy` and
`/support` routes return 404 until the approved release is deployed.

## iOS build provenance

| Item | Build 4 | Build 5 release candidate |
|---|---|---|
| Version | `0.1.0 (4)` | `1.0.0 (5)` |
| Bundle ID | `com.capturethis.ctcprinter` | `com.capturethis.ctcprinter` |
| Display name | Capture This | Capture This |
| Device family | iPhone + iPad | iPhone only |
| IPA SHA-256 | `0480b56e0ed5ae495059935cf7313c31e370f9cd897827c4f99acc4c11fc936f` | `0ba08aa4a9a502ef3907ebbf4ac367ee3d2625ed681e6001ec7f91935a389f05` |
| IPA status | Uploaded, processed, internally installed (prior audit/user evidence) | Signed App Store IPA built locally; not uploaded |

Build-4 evidence is preserved under the ignored local directory
`mobile/build/ios/ipa/build-4-evidence/`. File timestamps show the dirty local
brand/UI source was modified before the build-4 archive and IPA were produced,
so those brand changes are treated as part of build 4. The new security,
recovery, iPhone-only, privacy-manifest, and version changes were made afterward
and belong to build 5.

## Automated verification

| Check | Result |
|---|---|
| `npm test` | 100/100 passed |
| `npm run lint` | Passed |
| `npm run build` | Passed on Next.js 16.2.10 |
| `npm run verify:niimbot-export` | Passed; 591×354 PNG contract |
| `flutter pub get` | Passed |
| `flutter analyze` | Passed, no issues |
| `flutter test` | 24/24 passed, including three App Store screenshot regressions |
| `flutter build ipa --release` | Passed; 42.7 MB IPA, 177.6 MB archive |
| `npm audit --omit=dev` | Two moderate advisories in Next’s bundled PostCSS; no safe non-breaking remediation currently evidenced |

The IPA was inspected for version/build, bundle ID, iPhone-only device family,
portrait orientation, export-compliance flag, Bluetooth copy, application and
plugin privacy manifests, third-party notices, App Store distribution signing,
and `get-task-allow = false`. The non-shipping fictional screenshot strings are
absent from the release archive.

Three provisional App Store PNGs are recorded under
`docs/app-store-assets/iphone-6.9/`. Each was visually inspected, is exactly
1320×2868, has no alpha channel, and contains only fictional data. A real
connected/printing image or short demo remains pending the physical M2_H gate.

## Live boundary evidence

- HTTPS root returns 200.
- Signed-out operator routes redirect to login.
- Missing-token public production, label queue, PNG, and PATCH requests return
  sanitized 401 responses.
- Vercel reports the production deployment READY and no runtime error clusters
  in the inspected seven-day window.
- Environment variable names, applied Supabase migrations, Realtime publication,
  backup settings, disabled public sign-up, and a valid/revoked/expired token
  matrix still require private dashboard access or a disposable fixture.

## Release gates

| Gate | Status | Required evidence |
|---|---|---|
| Privacy/support owner approval | Blocked on owner | Approved wording before production deploy/attestation |
| Leaked temporary credential rotation | Blocked on owner | Rotate the affected temporary Supabase/Auth credential; never reuse it |
| Stable fictional review production | Blocked on private operator access | Active non-expiring fixture; token stored only in App Store Connect/private handoff |
| Physical iPhone + M2_H test | Blocked on hardware | Completed `docs/physical-release-test.md` record |
| External TestFlight | Pending | Build processed, Beta App Review approved, buddy pilot recorded |
| App Review | Pending | Production submission status and reviewer correspondence |
| Unlisted request | Pending | Apple-approved Unlisted App status |
| Permanent App Store link | Pending | Direct URL verified and final clean-device print smoke test |
