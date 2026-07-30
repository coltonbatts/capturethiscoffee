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
| Release/documentation commit(s) | `75c413b93f14665f22cfe6b35d9811f86b0cb15f` plus this evidence correction |
| Pull request | [#25](https://github.com/coltonbatts/capturethiscoffee/pull/25), ready for review |
| Required checks | Passed: Web, Mobile, Mobile screenshots, GitGuardian, Vercel, and Vercel Preview Comments |
| Merge commit | Pending |
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
| Signed archive/IPA validation | Pending |
| `git diff --check` | Passed |

## Production

| Item | Actual result |
|---|---|
| Verified Supabase project ref | `lehwhehssjfudyrtljus` (`coffee.capturethis`, `ACTIVE_HEALTHY`, PostgreSQL 17.6, `us-west-2`) |
| Build 13 migration | `20260730120000_build13_label_templates_and_closeout.sql` applied atomically and recorded as `build13_label_templates_and_closeout` |
| Production preflight | Remote ledger matched every local migration through Build 12; Build 13 was the only local-only migration. Exact 78,293-byte SQL passed a production transaction/rollback probe before apply |
| Production postflight | Eight published versions, Grid 01 default, RLS, invoker/fixed search paths, anonymous denial, authenticated grants, legacy fallback, strict assignment/locking, immutability, closeout, and Build 12 Active-day compatibility passed |
| Existing row counts | Before/after unchanged: clients 6, people 4, productions 1, roster 2, orders 2, auth users 4; the existing Active production remains a legacy null snapshot resolved deterministically to Grid 01 |
| Production data repair/deletion | None authorized or performed |
| Vercel project/domain | `capturethiscoffee` / `https://coffee.capturethis.com` |
| Production deployment | Pending |
| Public privacy/support health | Pending post-deploy |
| Protected/admin/fallback route health | Pending post-deploy |

## Signed binary and Apple

| Item | Actual result |
|---|---|
| Archive source | Pending exact merge commit |
| Marketing version/build | `1.0.0 (13)` source candidate; archive pending |
| Signing/bundle | `YW8K4837YB` / `com.capturethis.ctcprinter`; archive validation pending |
| IPA path, size, SHA-256 | Pending |
| App Store Connect build ID/state | Pending |
| Existing internal group | `Main` (`44678fa3-60ec-4971-9c1a-73b768e8a198`) |
| Internal assignment/installation | Pending |
| App metadata/privacy/reviewer fixture | Draft/private factual verification pending |
| App Review submission/result | Pending |
| Unlisted request/result | Pending |
| Manual release/direct link | Pending |
| Public TestFlight/searchable release | Not authorized; none represented |

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
