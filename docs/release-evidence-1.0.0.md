# Capture This 1.0.0 release evidence

Last updated: 2026-07-27 23:21 CDT

This file separates verified evidence from pending claims. Update it after each
preview/production deployment, TestFlight upload, physical run, and Apple
status change.

## Build 11 local release-hardening evidence — 2026-07-27

Build 11 is a local, signed release candidate only. It was built from an
uncommitted hardening working tree rooted at `main`
`08cbeec7010f076eec40082aca81f8071110b7f7`. Because the working tree is not a
commit, this artifact is verification evidence, not the upload artifact. No
commit, push, deployment, production mutation, upload, tester invitation, or
Apple submission occurred.

| Item | Verified result |
|---|---|
| Identity | `1.0.0 (11)`, `com.capturethis.ctcprinter`, display name Capture This |
| Scope | Every shipping batch affordance/callback/controller entry removed; one-label printing and conservative recovery preserved |
| Flutter dependency resolution | `flutter pub get` passed |
| Flutter static analysis | `flutter analyze` passed with no issues |
| Flutter tests | 164/164 passed, including no-batch shipping UI, individual actions/recovery, identity drift, and seven App Store image regressions |
| Local signed archive | `mobile/build/ios/archive-build11/Runner.xcarchive`, 181.6 MB before export |
| App Store IPA | `mobile/build/ios/ipa-build11/ctc_printer.ipa`, 23,124,902 bytes |
| IPA SHA-256 | `6271d8e5636c86291038e120eb23475dda43efcfb2a08699e12b5c3d1fa2d8ae` |
| Export signing | Apple Distribution; team `YW8K4837YB`; `get-task-allow=false`; beta reports entitlement present |
| Platform | arm64, iPhone device family `[1]`, portrait, minimum iOS 13.0 |
| Toolchain | Xcode 26.2 / iPhoneOS SDK 26.2, satisfying the current iOS 26 SDK submission floor |
| Bluetooth/export | Both purpose strings present; `ITSAppUsesNonExemptEncryption=false` |
| App icons | Every source icon is the declared dimension with no alpha, including 1024×1024; exported 120×120 and 152×152 assets also report no alpha |
| Privacy packaging | App manifest plus Flutter, app_links, secure storage, shared preferences, and URL launcher manifests are present and `plutil`-valid |
| Required-reason reconciliation | Flutter declares file timestamp (`0A2A.1`, `C617.1`) and system boot time (`35F9.1`); shared preferences declares UserDefaults (`1C8F.1`); other included plugin manifests declare no required-reason APIs |
| App-owned privacy declaration | Email Address, User ID, Other User Content, and Other Diagnostic Data; all linked, App Functionality, tracking false |
| Embedded backend boundary | Production Supabase host occurs once; disposable host occurs zero times; exactly one JWT is present and its role is `anon`; no complete `sb_secret_` value is present. Literal `service_role`/`sb_secret_` guard strings are expected because the app rejects privileged keys at startup |
| Printer dependency | Exact `niim_blue_flutter: 1.0.1` pin preserved |
| Frozen-web tests | `npm test` 105/105 passed |
| Frozen-web lint/build/export | `npm run lint`, `npm run build`, and `npm run verify:niimbot-export` passed; 591×354 geometry unchanged |
| Web client secret boundary | 55 static client artifacts contain no service-role environment marker, service-role marker, or complete `sb_secret_` value |
| Dependency audit | `npm audit --omit=dev` exited 1 with three high transitive findings in Next's bundled PostCSS 8.4.31 and Sharp 0.34.5; force fix would install Next 9.3.3 and was not run |
| App Store screenshots | Seven fictional 1320×2868 portrait RGB PNGs, no alpha; all visually inspected; no connected printer or physical success fabricated |
| Upload/Apple state | Not uploaded, not processed, not entered in App Store Connect, not submitted |
| Physical state | Not run. All Build 11 physical rows remain blank; the historical Operator 02 uncertain record remains unresolved |

The archive emitted Flutter's existing nonblocking CocoaPods-to-Swift-Package
migration notice. No dependency integration, printer firmware, printer library,
geometry, density, or irreversible printed-fact behavior was changed.

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
| Build-9 signed-in source | `47c4405` on `main` | Exact committed Build 9 app source; adds Supabase sign-in, Days, direct authenticated board access, per-user caching, and direct printed-status sync |
| Build-10 implementation source | App code at `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943`; clean archive source `ab5edb8bc6d0bf582746b81e1815dd0574a83320` on `main`, matching `origin/main` | Collect, optimistic shared board, durable conditional outbox, explicit conflicts, Realtime refresh signal, and monotonic printed-fact migration implemented; later commits through the archive source are release-evidence documentation only |
| Release pull requests | [PR #9](https://github.com/coltonbatts/capturethiscoffee/pull/9) and [PR #10](https://github.com/coltonbatts/capturethiscoffee/pull/10) | PR #9 merged; PR #10 reviewed for the current candidate |
| Release tag | Proposed `capture-this-v1.0.0` after physical/external pilot pass | Pending |
| Live URL | `https://coffee.capturethis.com` | HTTPS 200 verified |
| Live privacy/support | `https://coffee.capturethis.com/privacy` and `/support` | Both returned HTTP 200 at 17:22 CDT on 2026-07-27 and visibly identified Capture This plus `info@capturethis.com`; owner wording approval remains open |
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
| Source | Commit `47c4405` (`Ship Build 9 signed-in day selection`); this records the exact app source that had been implemented locally before the archive |
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

## TestFlight build 10 status

The owner explicitly authorized packaging and uploading Build 10 on 2026-07-27
to obtain its first device time through internal TestFlight. The incomplete
physical gates remain release/pilot risks; upload does not mark them passed.

| Item | Confirmed result |
|---|---|
| Source | Clean `main` at `ab5edb8bc6d0bf582746b81e1815dd0574a83320`, matching `origin/main`; Build 10 app implementation is `fea2fc3e0f8cb4a8039eade6f2d8362fd681a943` |
| Local artifact | `mobile/build/ios/ipa-build10/ctc_printer.ipa`, 23,128,931 bytes, SHA-256 `7a578953a32c5437f082392141b06559bce81eaab7252657ee9aa2366e9e30b7` |
| Artifact identity | `1.0.0 (10)` / `com.capturethis.ctcprinter`; Apple Distribution signed for team `YW8K4837YB`; `get-task-allow = false`; `beta-reports-active = true` |
| Release configuration | Dart AOT contains production host `lehwhehssjfudyrtljus.supabase.co` once, disposable host `svqxznvyrbmbqihekkwo.supabase.co` zero times, and one public `anon` JWT for the matching production ref; no privileged JWT |
| Automated verification | Immediately before archive, `flutter analyze` passed with no issues and `flutter test` passed 158/158 |
| Upload workflow/time | Xcode command-line distribution reported `Upload succeeded` at 4:24 PM CDT on 2026-07-27 |
| Processing | Complete by 4:26 PM CDT. Apple/TestFlight emailed that `Capture This Printer 1.0.0 (10) for iOS is now available to test` |
| Internal availability | Ready to install through TestFlight for the existing internal tester; the availability email was received at 4:26 PM CDT |
| Physical status | Build 10 has no recorded physical device acceptance. The paired iPhone reports production bundle `1.0.0 (10)`, but that installation fact is not a visible open/version check or physical pass. Build 9 baseline gates 4, 7, 8, and 10 remain open; Gate 3 remains a recorded batch failure with single-label printing as the supported mode. A 17:31 CDT read-only container audit confirmed Fictional Operator 02 still has one unresolved uncertain record after paper emerged and requires physical inspection before any recovery choice |
| External TestFlight | Existing group `Capture This crew pilot` has no build or tester assigned; review not submitted. Owner approved the exact Build 10 beta description, What to Test, review notes, demo instructions, hardware explanation, and export-compliance draft at 18:42 CDT on 2026-07-27. Review contact is Kait Batts; the phone/email were supplied privately and are not stored in Git. Owner declined `info@capturethis.com` for tester feedback | Blocked on a replacement feedback email, separate privacy/support attestations, an explicitly authorized production fictional account plus Active day, and explicit submission approval |
| TestFlight expiration | Expected around 2026-10-25 from the 90-day window | Estimate only; authoritative App Store Connect date still required. A 2026-07-27 read-only browser attempt reached Apple sign-in because no authenticated session was connected; no App Store field changed |

The focused Build 10 tests cover:

- complete-roster Collect states and optimistic Collect-to-Print updates;
- durable coalescing order intent across simulated force-quit;
- three offline captures plus two print facts replaying once after reconnect;
- no second replay on a later refresh;
- a competing server edit producing a visible conflict without overwrite;
- printed-fact replay continuing despite an ordinary-field conflict;
- local printed overlays not being mistaken for server confirmation;
- active-only replay and debounced Realtime-triggered authoritative refresh.

The monotonic printed-fact migration exists at
`supabase/migrations/20260725120000_preserve_printed_order_facts.sql` and is
applied and trigger-verified in production. A clean disposable local Supabase
2.109.1 stack separately verified the migration, authenticated RLS,
stale-write refusal, monotonic printed facts, and the filtered `public.orders`
Realtime signal. Production Realtime publication membership remains
unverified, but Build 10 retains polling, resume, pull-to-refresh, and manual
refresh fallbacks.

On 2026-07-27, the owner authorized private disposable project
`capture-this-build10-disposable` (`svqxznvyrbmbqihekkwo`). After an exact
dry-run, the pre-Build-10 schema snapshot, orders-Realtime migration, and Build
10 migration were applied there. Remote migration history records all three,
a second dry-run reports up to date, authenticated remote schema dumps verify
the two order triggers, core RLS, and `public.orders` publication membership,
and an anonymous orders read was refused with HTTP 401 / Postgres `42501`.
Public-key sessions for both disposable users then passed authenticated RLS,
conditional order/usual conflicts, competing-value preservation, irreversible
printed facts, identical-update revision detection, and filtered Realtime.
Transient verifier rows were removed and audited absent. Persistent fictional
fixture `build10-20260727-a` was seeded with five days, 24 people, and 48
orders for physical acceptance. After the first ten-label batch stopped before
paper emerged, one uniquely named fictional replacement person/order was added
through Account A's public RLS session so a fresh ten-label queue could be run
without resetting the now-printed retry row. The fixture therefore now has five
days, 25 people, and 49 orders. Production project
`lehwhehssjfudyrtljus` was never linked or mutated.

At 18:48–18:53 CDT on 2026-07-25, release validation reran the full local
evidence from clean `fea2fc3`: Flutter analysis and 158/158 tests, frozen-web
105/105 tests, lint, Next.js production build, 591×354 NIIMBOT verification,
and a fresh localhost-only Supabase proof all passed. A physical iPhone 16 on
iOS 18.7.2 is running exact detached Build 9 from `47c4405` in an isolated
side-by-side bundle configured only for the disposable project. Physical gates
1, 2, 5, 6, and 9 have passed; the ten-label rerun and the remaining physical
checks are still open. See
`docs/build-10-release-validation-2026-07-25.md`.

## Production migration state — 2026-07-27

Before this date, production `lehwhehssjfudyrtljus` was applied through
`20260703120000_authenticated_full_access`, which the owner ran by hand in the
Supabase SQL editor. Manual SQL-editor runs do not write to
`supabase_migrations.schema_migrations`, so production's CLI migration ledger
must **not** be trusted and `supabase db push` must **not** be run against it —
it would attempt to replay twelve older migrations, including a
`drop table … cascade` in `20260624130000_drop_print_station_tables.sql` and a
row deletion in `20260605124500_remove_example_people.sql`.

On 2026-07-27 the owner explicitly authorized applying the two migrations Build
10 assumes, and applied them by hand in the production SQL editor.

| Migration | Purpose | Production status |
|---|---|---|
| `20260725120000_preserve_printed_order_facts.sql` | `orders_preserve_label_printed` trigger making `label_printed: true` irreversible | **Applied and verified.** `pg_trigger` reports `orders_preserve_label_printed` with `tgenabled = 'O'`, alongside the pre-existing `orders_set_updated_at` |
| `20260706120000_enable_orders_realtime.sql` | Adds `public.orders` to the `supabase_realtime` publication | **Not yet verified.** The publication-membership query has not been returned. The migration is wrapped in an `if exists (… pubname = 'supabase_realtime')` guard, so it silently no-ops when that publication is absent — a successful run is not evidence that `orders` is published |

Until the publication query is returned, treat Realtime on production as
unconfirmed. Build 10 degrades safely if it is absent: Realtime is only a
refresh signal, and ten-second polling, app-resume refresh, pull-to-refresh, and
manual sync all remain authoritative.

## Automated verification

| Check | Result |
|---|---|
| `npm test` | 104/104 passed |
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
| Preserved Build 9 embedded target audit | The IPA's Dart AOT framework contains the production Supabase hostname, not the authorized disposable hostname. It is provenance evidence only and is prohibited for fictional acceptance writes |
| `flutter analyze` (Build 10 local source) | Passed, no issues |
| `flutter test` (Build 10 local source) | 158/158 passed, including Collect, serialized durable outbox writes, relaunch/replay, conflict, Realtime-signal, and monotonic print recovery coverage |
| Frozen-web regressions with Build 10 local source | `npm test` 105/105, `npm run lint`, `npm run build`, and `npm run verify:niimbot-export` passed |
| Clean disposable local Supabase verification | Passed: anonymous RLS refusal, authenticated read/write, successful then stale order and usual-order CAS, irreversible `label_printed: true`, and filtered authenticated Realtime update; production untouched |
| Authorized disposable remote Supabase migration preflight | Passed for `svqxznvyrbmbqihekkwo`: exact dry-run, three applied migration-ledger entries, second dry-run up to date, trigger/RLS/publication schema verification, and anonymous `orders` refusal |
| Remote-safe Supabase verifier and post-change regression | `scripts/verify-build10-remote-supabase.mjs` syntax and its authorized-host/production-host/privileged-key guards passed. At 11:59 CDT on 2026-07-27, Flutter analysis and 158/158 tests plus frozen-web 105/105 tests, lint, production build, and NIIMBOT export verification all passed |
| Authenticated disposable remote verification | Passed with two public-key user sessions: authenticated RLS, order/usual CAS plus stale refusal, competing-value preservation, irreversible printed fact, identical-update revision advance, filtered Realtime, and zero-row cleanup audit |
| Physical fixture manager | Safety guards and syntax passed; seeded `build10-20260727-a` with five fictional days, 24 people, and 48 orders; Account B verified expected counts. One fresh fictional replacement person/order was later added through the public authenticated RLS path after a no-paper batch interruption, yielding 25 people and 49 orders without resetting any printed row |
| Final post-tool regression | Before 12:20 CDT on 2026-07-27: Flutter analysis and 158/158 tests, frozen-web 105/105, warning-free lint, production build, and unchanged 591×354 NIIMBOT verification passed |
| Detached Build 9 physical source | Clean `47c4405`; `niim_blue_flutter: 1.0.1`; Flutter analysis and 140/140 tests passed. A disposable-host-only release build was installed directly in isolated bundle `com.capturethis.ctcprinter.build10validation`; no archive, IPA export, or upload occurred |
| Build 10 archive / IPA / upload | Passed on 2026-07-27: clean production-configured archive `1.0.0 (10)`, signed IPA SHA-256 `7a578953a32c5437f082392141b06559bce81eaab7252657ee9aa2366e9e30b7`, Xcode command-line `Upload succeeded`, and TestFlight availability email received at 4:26 PM CDT |
| `npm audit --omit=dev` | **Failed again at 17:22 CDT on 2026-07-27:** three high package findings remain in Next 16.2.11's bundled PostCSS 8.4.31 and Sharp 0.34.5 paths; top-level Sharp is 0.35.3. The suggested force fix would install breaking Next 9.3.3, so no dependency was changed |

The build-6 IPA was inspected for version/build, bundle ID, iPhone-only device family,
portrait orientation, export-compliance flag, Bluetooth copy, application and
plugin privacy manifests, App Store distribution signing, and
`get-task-allow = false`.

The web build's 54 client artifacts contain no
`SUPABASE_SERVICE_ROLE_KEY` identifier, `service_role` marker, or service-role
JWT. The configured service-role value is not available locally and was not
copied into evidence.

Seven current Build 11 App Store PNGs are recorded under
`docs/app-store-assets/iphone-6.9/`. Each was visually inspected, is exactly
1320×2868 RGB with no alpha channel, contains only fictional data, and does not
claim a printer connection or physical success. A historical real
connected/printing image records the first Build 6 holographic reprint in
`docs/milestones/2026-07-24-build-6-holographic-first-print.md`; it is not Build
11 acceptance evidence.

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
| Privacy/support deployment | Existing pages are live; corrected Build 11 source copy is not deployed | Owner/legal approval, named contact owners, explicit deployment approval, then live verification |
| Leaked temporary credential rotation | Blocked on owner | Rotate the affected temporary Supabase/Auth credential; never reuse it |
| Public Supabase signup disabled | Verified live | Public settings reported `disable_signup: true` |
| Dependency security gate | Next.js 16.2.11 deployed; three high bundled PostCSS/Sharp findings remain open | Named owner accepts `dependency-risk-acceptance-2026-07-27.md`, or a supported upstream fix is reviewed and deployed |
| Stable fictional review production | Blocked on explicit production-write approval, private operator access, and named cleanup owner | Owner-provisioned invited account plus Active fictional production; credentials stored only in App Store Connect/private handoff |
| Physical iPhone + M2_H test | Historical Build 9 checks 1, 2, 5, 6, 9 passed; batch failed twice and remains failed-with-limitation. Build 11 has no physical observations | Complete every direct-observation row in `build-11-physical-release-worksheet-2026-07-27.md`; never resolve the uncertain Operator 02 record without inspecting paper |
| App Store Connect build status | Build 10 is internal TestFlight evidence. Build 11 exists only as a local signed verification artifact | After code/owner gates and explicit upload approval, create a reproducible committed Build 11 artifact, upload, and record processing/expiration |
| External TestFlight | Group created; no Build 11, review submission, or buddy invitation | Approve Build 11 packet/contacts/privacy/support, authorize and verify the fictional fixture, authorize upload, complete physical gate, authorize Beta App Review, then invite only after Apple approval |
| App Review | Pending | Production submission status and reviewer correspondence |
| Unlisted request | Pending | Apple-approved Unlisted App status |
| Permanent App Store link | Pending | Direct URL verified and final clean-device print smoke test |
