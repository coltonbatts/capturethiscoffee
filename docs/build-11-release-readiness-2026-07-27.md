# Build 11 release-readiness decision

Prepared: 2026-07-28
Candidate: Capture This `1.0.0 (11)` /
`com.capturethis.ctcprinter`
Decision: **code-ready local candidate; no-go for external TestFlight or
permanent App Review today**

## Outcome

The smallest defensible binary change is implemented and verified locally:

- before this pass, the shipping Flutter/iOS source had not changed since the
  Build 10 archive source `ab5edb8`; intervening commits were documentation/test
  evidence only;
- the unsupported shipping batch action, confirmation, callbacks, controller
  method, error state, help copy, screenshot fixture, and current operator
  instructions are removed;
- the supported path remains one label at a time with duplicate-safe recovery;
- the irreversible `label_printed: true` behavior, offline replay/conflict
  protection, web fallback, printer pin, geometry, and density are unchanged;
- version/build is `1.0.0 (11)` with a regression preventing pubspec/About drift;
- the application privacy manifest now declares the data actually transmitted;
- seven truthful fictional 6.9-inch screenshots replace the Build 5 package;
- the preserved signed archive/IPA was re-inspected, and mobile tests,
  frozen-web tests, lint, build, plist validation, formatting, and NIIMBOT
  export pass.

During the local hardening pass, no production data, production configuration,
live web content, App Store Connect field, tester, upload, submission,
invitation, printer firmware, database record, commit, or remote branch was
changed. The owner subsequently authorized only a full Git commit and push to
`main`; that authorization does not include any other release action.

## Verification summary

| Check | Result |
|---|---|
| `flutter pub get` | Pass |
| `flutter analyze` | Pass, no issues |
| `flutter test` | Pass, 164/164 |
| Dart formatting | Pass; 14 modified Dart files checked, 0 changed |
| `plutil -lint mobile/ios/Runner/PrivacyInfo.xcprivacy` | Pass |
| Preserved signed release archive/IPA with reviewed public defines | Re-inspected; `1.0.0 (11)`, IPA 23,124,902 bytes, SHA-256 `6271d8e5636c86291038e120eb23475dda43efcfb2a08699e12b5c3d1fa2d8ae` |
| IPA privacy/signing/identity/permissions inspection | Pass for the preserved local evidence artifact; six embedded manifests parse |
| iPhone only | Pass; device family `[1]` |
| Current SDK floor | Pass; Xcode/iPhoneOS SDK 26.2 |
| Icons | Pass; all declared source dimensions, no alpha |
| Screenshots | Pass; seven × 1320×2868 RGB/no alpha, visually inspected; committed copies pixel-match deterministic Flutter goldens |
| Privileged-key/disposable-host audit | Pass; one `anon` JWT, no complete secret key, production host once, disposable host absent |
| `npm test` | Pass, 105/105 |
| `npm run lint` | Pass |
| `npm run build` | Pass, Next.js 16.2.11 |
| `npm run verify:niimbot-export` | Pass, 591×354 |
| npm registry compatibility recheck | Latest stable remains Next.js 16.2.12 with PostCSS 8.4.31 and Sharp `^0.34.5`; no complete compatible stable fix |
| `npm audit --omit=dev` | **Fail**, three high transitive findings in Next's nested PostCSS/Sharp; force fix proposes prohibited Next 9.3.3 and was not run |
| `git diff --check` | Pass |
| Physical Build 11 gate | **Not run** |
| App Store Connect/live review state | **Not changed or reverified** |

The signed artifact was not rebuilt in this pass because the final fixes after
its production changed only tests, documentation, and frozen-web support copy.
No Flutter shipping source, iOS metadata, App Store asset, or release
configuration changed. The IPA still came from an uncommitted tree and remains
verification evidence only, never an upload artifact.

## Concise diff

- Flutter: delete all batch-print UI/controller paths; retain single-label and
  recovery paths; wrap authenticated footer actions to fix a screenshot-found
  31-pixel overflow.
- Identity/tests: bump to Build 11; add identity drift and no-batch UI
  regressions; retain recovery coverage.
- Privacy: declare linked Email Address, User ID, Other User Content, and Other
  Diagnostic Data for App Functionality; tracking remains false.
- Web source, not deployed: align privacy/support copy with actual data flows and
  sequential one-label operation.
- Assets/tooling: replace three stale Build 5 assets with seven current screens;
  move generation into deterministic Flutter goldens that load real app/icon
  fonts and assert exact dimensions.
- Operations/release: add Build 11 privacy, review, physical, risk, and readiness
  records; correct the exact conflict button names and exact-TestFlight physical
  sequence; make current fallback instructions sequential while retaining the
  historical failed-batch evidence.

Exact planned commit inventory relative to
`08cbeec7010f076eec40082aca81f8071110b7f7`: **61 paths** — 33 modified, 8
deleted, and 20 added, containing 1,603 insertions and 604 deletions. By
surface: 29 documentation/asset paths, 30 mobile/iOS/test paths, and 2
frozen-web source paths.

## Blockers

| Category | Blocker | Owner/next evidence |
|---|---|---|
| Code | No unresolved shipping-code defect was found locally. The preserved signed IPA predates the owner-authorized commit and is not a reproducible upload artifact | Rebuild from the exact published commit, then record matching hash/inspection |
| Code | Flutter reports the existing CocoaPods-to-SPM migration notice | Nonblocking for Build 11; migration belongs in a later physically tested maintenance build |
| Privacy/compliance | Owner/legal has not approved the corrected privacy/support wording, nutrition-label answers, diagnostics classification, retention, contact, or owner-provisioned/no-account-creation analysis | Written decisions and named policy/support owners; current Apple guidance does not establish an in-app deletion requirement without account creation |
| Privacy/compliance | Corrected privacy/support source is not live | Explicit deployment approval, deploy from reviewed source, then verify both live URLs |
| Privacy/compliance | Xcode's Organizer privacy report has not been exported as a separate human-reviewed attachment; no supported CLI generator was available, so this is not a pass | Generate/review the final committed archive report before upload/submission |
| Physical hardware | No exact TestFlight Build 11 session; no direct version, airplane-mode, edits, prints, paper, conflicts, haptics, Reduce Motion, interruption, reconnect, fallback, or independent-operator observation | Complete every blank in the Build 11 physical worksheet |
| Physical hardware | Firmware, ribbon brand/lot/condition, and stock brand/lot remain unrecorded | Record only; never update firmware |
| Physical hardware | Historical Operator 02 uncertain record remains unresolved | Inspect the corresponding physical paper; otherwise leave it unresolved |
| App Store Connect/owner input | Build 11 is not uploaded/processed; no Build 11 TestFlight assignment or Beta App Review | Separate explicit upload and submission approvals after prior gates |
| App Store Connect/owner input | Feedback email, reverified reviewer contact, private review credentials, fixture owners/cleanup, external tester, age rating, content rights, export answer, regions, price, categories, release method, and unlisted approval are incomplete | Supply/approve the private-value register in the Build 11 review packet |
| App Store Connect/owner input | Support/release ownership and backup are unnamed | Fill the ownership register |
| Security/operations | `npm audit` reports three high transitive Next/PostCSS/Sharp findings; no compatible stable aggregate fix exists | Named risk owner accepts the time-bounded record or approves a supported mitigation |
| Security/operations | Production Realtime publication remains unverified; polling/resume/manual refresh compensate | Read-only owner verification before permanent release |
| Security/operations | Prior temporary-credential rotation status and backup/restore ownership remain open in historical release evidence | Owner verification and sanitized evidence |

## Readiness

Percentages measure evidence completed for the named distribution state, not
code quality alone.

| Target | Readiness | Why |
|---|---:|---|
| Internal TestFlight Build 11 | **94%** | Local source, tests, archive evidence, manifest, and assets are clean and Git publication is authorized; committed-source rebuild and upload authorization remain |
| External pilot | **64%** | Code, draft packet, privacy manifest, assets, and instructions are ready; physical gate, live policy approval, fixture, private fields, upload, and Beta Review remain |
| Scoped unlisted App Store release | **47%** | External-pilot evidence, permanent metadata/attestations, App Review, unlisted request, ownership, and security acceptance remain |
| Fully independent app-first product | **34%** | Day/people/roster creation, summary/share, closeout, local-PNG fallback, complete operational ownership, and replacement-build independence remain |

## Go/no-go

- **External TestFlight:** **No-go now.** Conditional go only after a committed
  reproducible Build 11 is uploaded with authorization, the exact TestFlight
  binary passes the physical worksheet, live privacy/support copy is approved
  and deployed, the fictional fixture and private values are verified, and the
  owner authorizes Beta App Review.
- **Permanent App Review/unlisted release:** **No-go.** First complete the
  external pilot, close or accept the security/operations risks, complete
  metadata/legal attestations and ownership, then authorize App Review and the
  unlisted-distribution request separately.

## Shortest safe owner sequence

1. **Authorized 2026-07-28:** stage, commit, and push this exact reviewed Build
   11 tree to `main`. Rebuild and inspect a clean local artifact from the
   published commit before any upload.
2. Approve or revise the privacy/support draft, nutrition-label answers,
   account-deletion analysis, and dependency-risk disposition; name privacy,
   support, security, and release owners/backups.
3. Supply the missing App Store private values and attestations: feedback and
   reviewer contacts, age rating, content rights, export compliance, regions,
   price, categories, manual release choice, and unlisted-distribution intent.
4. Authorize the fictional production review account/day, provisioning owner,
   cleanup owner/trigger, and optional Legacy fixture. Provision with fictional
   data only and verify credentials privately.
5. Separately authorize Build 11 upload. Record processing, TestFlight identity,
   Internal-Only status, and expiration.
6. Run the exact physical worksheet on the TestFlight binary and accepted M2_H.
   Inspect paper before resolving any uncertainty; obtain independent-operator
   completion.
7. If the gate passes, separately authorize the live privacy/support deployment,
   Test Information writes, external group assignment, and Beta App Review.
   Invite the named tester only after Apple approves the build.
8. Complete the external pilot; fix any release blocker with a new build. Then
   approve permanent metadata/privacy, App Review, manual release, and the
   unlisted request as separate actions.

The Git publication authorization does not authorize an upload, deployment,
production write, App Store Connect change, or physical pass. After the
committed-source rebuild, the next owner decision is approval or revision of
the privacy/support drafts, App Privacy answers, dependency-risk disposition,
and named owners.

## Controlled roadmap

1. Finish Build 11 hardening evidence and physical pilot gate.
2. Run a small external pilot; prioritize duplicate safety, offline replay,
   hardware recovery, support load, and clean reinstall evidence.
3. Submit the same scoped capability for unlisted distribution after the pilot
   and owner/legal/security gates.
4. Only afterward resume the capabilities now planned for Builds 12–14:
   online day/people/roster preparation first; summary/share, guarded closeout,
   runner-link creation and local label PNG second; then independent
   install-to-closeout, reduced Legacy dependence, and named replacement-build
   ownership. Those capabilities require Build 12 or later.

## Current Apple primary-source checks

- New iOS submissions after April 28, 2026 require the iOS 26 SDK or later:
  <https://developer.apple.com/news/?id=ueeok6yw>
- Screenshot dimensions/count:
  <https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications>
- App privacy definitions:
  <https://developer.apple.com/app-store/app-privacy-details/>
- Privacy manifests and required-reason APIs:
  <https://developer.apple.com/documentation/bundleresources/privacy_manifest_files>
- Account-deletion rule:
  <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
- External TestFlight:
  <https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers>
- Unlisted distribution:
  <https://developer.apple.com/support/unlisted-app-distribution/>
