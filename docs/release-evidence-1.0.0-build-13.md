# Capture This 1.0.0 (13) release evidence

Date opened: 2026-07-30
Release identity: `1.0.0 (13)`
Bundle identifier: `com.capturethis.ctcprinter`
Apple team: `YW8K4837YB`
Branch: `codex/build-13-app-store-launch`
Starting commit: `6481f46f841cfbf0a8c67b0523b4d2e9508799f6`

This ledger records actual Build 13 results. A blank or pending row is an open
gate, not a pass. Software, screenshot, simulator, upload, processing, and
review evidence cannot substitute for physical printer acceptance.

## Source and review

| Item | Actual result |
|---|---|
| Implementation commit(s) | `50584845dde372b898d8286c26e0bdc1b4377c49` |
| Release/documentation commit(s) | `75c413b93f14665f22cfe6b35d9811f86b0cb15f`, `31d1b90e7de2690120dfc5a21db92c6bc829b738`, and `431eaa33e66e527b0454a041b037847de0bb7dcc` |
| Pull request | [#25](https://github.com/coltonbatts/capturethiscoffee/pull/25), squash-merged |
| Required checks | Passed: Web, Mobile, Mobile screenshots, GitGuardian, Vercel, and Vercel Preview Comments |
| Merge commit | `8dab20e9f737a0d83e3ed21dea2c0417b4b5546c` |
| Force push | None authorized or performed |

## Automated release gate

| Gate | Actual result |
|---|---|
| `npm ci` | Passed on 2026-07-30; 383 packages installed from the lockfile |
| `npm run lint` | Passed |
| `npm run test` | Passed: 115/115 tests, 27 suites, 0 failures |
| `npm run build` | Passed with Next.js 16.2.11; `/labels/templates` is server-rendered |
| `npm run verify:niimbot-export` | Passed: 591×354 PNG, 18 px safe margin, 567 px effective width |
| `npm audit --omit=dev` | Non-passing advisory gate: three high transitive findings in Next's nested PostCSS/Sharp; the only offered command is a forced breaking Next downgrade, which was not run |
| Full disposable Supabase replay and lint | Passed through the base schema and every migration; public/extensions lint reported no schema errors |
| Build 12 database verifier | Passed against the final Build 13 schema |
| Build 13 database verifier | Passed: eight seeds, legacy Grid 01 fallback, draft/publish/assign, lifecycle, closeout, and immutable completion |
| `flutter pub get` | Passed; exact lockfile pin retained |
| `flutter analyze` | Passed: no issues |
| `flutter test` | Passed: 203/203 tests, 0 failures |
| Flutter formatting | Passed for all 28 changed/new Dart files: 0 changes required |
| iOS simulator build | Passed; `Runner.app` built without codesigning; existing CocoaPods-to-SPM notice left unchanged |
| Release identity and screenshots | Passed in the 203-test suite; `1.0.0 (13)` and nine 1320×2868 RGB/no-alpha images verified |
| Signed archive/IPA validation | Passed from the exact merge commit: App Store export, Apple Distribution signature, store provisioning, bundle/version/build, designated requirement, privacy manifests, `get-task-allow = false`, and public `anon` JWT role only |
| `git diff --check` | Passed |

## Production

| Item | Actual result |
|---|---|
| Verified Supabase project ref | `lehwhehssjfudyrtljus` (`coffee.capturethis`, `ACTIVE_HEALTHY`, PostgreSQL 17.6, `us-west-2`) |
| Build 13 migration | `20260730120000_build13_label_templates_and_closeout.sql` applied atomically and recorded as `build13_label_templates_and_closeout` |
| Production preflight | Remote ledger matched every local migration through Build 12; Build 13 was the only local-only migration. Exact 78,293-byte SQL passed a production transaction/rollback probe before apply |
| Production postflight | Eight published versions, Grid 01 default, RLS, invoker/fixed search paths, anonymous denial, authenticated grants, legacy fallback, strict assignment/locking, immutability, closeout, and Build 12 Active-day compatibility passed |
| Existing row counts at migration | Before/after unchanged: clients 6, people 4, productions 1, roster 2, orders 2, auth users 4; the existing Active production remains a legacy null snapshot resolved deterministically to Grid 01 |
| Production data repair/deletion | None authorized or performed |
| Vercel project/domain | `capturethiscoffee` / `https://coffee.capturethis.com` |
| Production deployment | READY: `dpl_FuoQMcfPjnzMU1Cxa7cm5PV9Jshx`, exact source `8dab20e9f737a0d83e3ed21dea2c0417b4b5546c`, aliased to `https://coffee.capturethis.com` |
| Public privacy/support health | Passed: `/`, `/login`, `/privacy`, `/support`, and `/manifest.webmanifest` returned 200 with current Capture This privacy, closeout, support, NIIMBOT, and recovery copy |
| Protected/admin/fallback route health | Passed: anonymous requests redirect to sign-in; the persistent fictional review account authenticated and loaded Days, People, Labels, and all eight published versions in Label templates |
| Fictional review fixture | Persistent invited account plus one Planning day, one Active day, four clearly fictional people, and eight scoped roster/order rows. Credentials are not committed and the password is held only in the local macOS Keychain |

## Signed binary and Apple

| Item | Actual result |
|---|---|
| Archive source | Exact squash merge `8dab20e9f737a0d83e3ed21dea2c0417b4b5546c` in a detached clean worktree |
| Marketing version/build | `1.0.0 (13)` |
| Signing/bundle | Apple Distribution / `YW8K4837YB` / `com.capturethis.ctcprinter`; store profile; `get-task-allow = false` |
| IPA path, size, SHA-256 | Local release artifact `ctc_printer.ipa`; 23,630,395 bytes; `569aff753fe9851ccb600dcb21a7c4f1a3d9cb125fe233d16dc7bfe46c08e65b` |
| App Store Connect build ID/state | `79ca63c6-38b1-43d6-af1e-d0f4b2d44e47`; upload processing Complete, binary Validated, `1.0.0 (13)`, non-exempt encryption No |
| Existing internal group | `Main` (`44678fa3-60ec-4971-9c1a-73b768e8a198`) |
| Internal assignment/installation | Build 13 is assigned only to internal `Main` with one tester; tester guidance is saved; installation is not represented as complete |
| App metadata/privacy/reviewer fixture | Storefront record `Capture This Coffee` (App ID `6786807268`); free; United States only; manual release; 4+; nine screenshots; metadata, secure review access, and notes saved. Seven conservative privacy data types are fully configured in an unpublished draft. Copyright, Admin privacy publication, reviewer contact, content rights, and legal attestations remain owner-controlled |
| App Review submission/result | Not submitted. App Store validation requires copyright information and Admin-published App Privacy |
| Unlisted request/result | Pending |
| Manual release/direct link | Pending |
| Public TestFlight/searchable release | Not authorized; Build 13 is not assigned to the existing external group, no public link was created, and no App Store release occurred |

## Physical and operator evidence

The exact
[Build 13 physical acceptance worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md)
is incomplete. No physical pass is claimed until the signed Build 13 binary is
run on the recorded iPhone/iOS and the designated M2_H, firmware, ribbon,
50×30 mm holographic stock, and density 3, with direct operator observations.

## Privacy and safety statements

- The iOS target uses the public Supabase URL/key plus the invited user's
  session. No service-role credential is accepted by or embedded in the app.
- Public signup remains disabled.
- Label templates are bounded declarative data; no JavaScript, Dart, CSS,
  scripted SVG, WebAssembly, URL asset, plugin, or other executable payload is
  accepted.
- Individual printing, monotonic printed facts, physical-outcome recovery,
  Planning/Complete refusal, and offline cached output remain release
  invariants. There is no batch-print action.
- Current release-facing material uses fictional people and neutral operator
  roles; it does not use a client's personal name.

The fuller implementation and promotion narrative is
[`build-13-app-store-launch-2026-07-30.md`](build-13-app-store-launch-2026-07-30.md).
The authenticated Apple record is
[`build-13-app-store-connect-evidence-2026-07-30.md`](build-13-app-store-connect-evidence-2026-07-30.md).
