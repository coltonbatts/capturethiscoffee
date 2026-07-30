# Build 13 App Store launch

Date: 2026-07-30
Branch: `codex/build-13-app-store-launch`
Worktree: `/Users/coltonbatts/Desktop/CaptureThisCoffee-build13`
Starting commit: `6481f46f841cfbf0a8c67b0523b4d2e9508799f6`
Target identity: `1.0.0 (13)`
Distribution target: free, manually released, unlisted App Store
Status: implementation, integrated verification, PR checks, and production
database migration complete; merge and production web promotion in progress

## Objective

Ship Capture This as a finished operator product with a versioned declarative
label-template system, offline cached rendering, native summary/share,
guarded closeout, current App Store material, and a durable unlisted
installation path.

The release remains one-label-at-a-time on the accepted NIIMBOT M2_H. Passing
software tests, upload processing, TestFlight assignment, or App Review cannot
stand in for physical printer acceptance.

## Baseline verified before editing

| Gate | Result |
|---|---|
| Source | Clean Build 13 worktree from verified `origin/main` `6481f46` |
| Primary checkout | Dirty with user-owned documentation/output changes; left untouched |
| Web install | `npm ci` passed |
| Web lint | Passed |
| Web tests | 108 passed |
| Web production build | Passed on Next.js 16.2.11 |
| NIIMBOT export | Passed at exactly 591×354 |
| Dependency audit | Three known high transitive findings in Next's nested PostCSS/Sharp; no force fix run |
| Flutter | 3.44.4 / Dart 3.12.2 |
| Flutter analysis | Passed |
| Flutter tests | 182 passed |
| iOS simulator build | Passed; existing CocoaPods migration notice retained |
| Printer dependency | Exact `niim_blue_flutter: 1.0.1` pin verified |
| Vercel | Production deployment for `6481f46` is READY |

## Protected product invariants

- Authenticated invited-user access; public signup remains disabled.
- Normal app access uses the public Supabase URL/key and the user session.
- No service-role credential enters the app.
- Collection and individual printing remain offline-capable.
- Printed facts remain monotonic.
- Uncertain output still requires physical inspection before retry or sync-only.
- Planning and Complete days refuse printing.
- No batch-print action or unattended-print claim.
- Printer model, protocol, density 3, media geometry, dependency pin, and
  recovery behavior remain unchanged.
- `/labels` remains a working authenticated PNG/CSV fallback.

## Implementation records

### Declarative templates

The canonical
`mobile/assets/label_templates/label-templates-v1.json` catalog defines all
eight existing designs at schema version 1. TypeScript, Dart, and the database
validate the same bounded flat primitive/binding/font/color contract. The web
screen proof, browser PNG, server PNG, native preview, test label, and physical
print path interpret the declarative definition rather than maintaining eight
unrelated platform implementations.

Catalog SHA-256:
`3c392821d58050529d16db2b2de570a20807ef741e5db5c41338d03e949a01a7`.
Long-name semantics require line height at least font size and keep Cameron
Ellington-Smythe inside the declared hero box without overlap.

### Database contracts

Migration
`20260730120000_build13_label_templates_and_closeout.sql` adds template
identity/version/settings tables, per-production snapshots, completion
metadata, invoker RPCs, RLS/grants, bounded validation, immutable publishing,
Planning-only assignment, forward-only production status, and completed-child
immutability.

The final catalog seed bytes match the canonical JSON exactly. A disposable
Supabase `2.109.1` replay through every historical migration plus Build 13
passed, warning-level schema lint reported no errors, and both the Build 12
compatibility verifier and Build 13 authenticated lifecycle/closeout verifier
passed. The static database contracts passed 3/3. No production write has
occurred at this stage.

### Web administration

Authenticated `/labels/templates` now provides a version ledger, exact
long-name proof, new/duplicated drafts, JSON editing, browser/server/database
validation, immutable publishing, confirmed future-day default changes,
Planning assignment, prior-version rollback, and visible Draft, Published,
Default, Assigned, Locked, and app-schema compatibility states. `/labels`
renders/exports the production's exact published version or deterministic
legacy Grid 01; the browser-local design override is gone.

### Native synchronization and renderer

The authenticated board resolves its production template, validates before
use, keeps the last-known-good snapshot in the account/day-scoped board cache,
preserves it after refresh failure, rejects incompatible future schema
versions, and uses bundled Grid 01 when no valid cached/assigned version is
available. Template data never enters the order outbox. Preview, fictional test
label, and production printing share the same local renderer.

### Summary, share, and closeout

Native **Summary & closeout** groups shop quantities, shows every on-set
person's Waiting/Captured waiting to print/Printed/No drink state, produces
deterministic share text, and invokes the iOS share sheet. Closeout remains
online-only and locally guards stale/offline state, pending mutations,
conflicts, uncertain print recovery, waiting orders, and captured-unprinted
labels. The database locks/rechecks the production and returns the authoritative
result; the client never marks a rejected closeout complete optimistically.

## Release ledger

The final local software gate passed 115/115 web tests and 203/203 Flutter
tests, plus lint, production web build, NIIMBOT export verification, changed
Dart formatting, iOS simulator compilation, full-history database replay, both
database verifiers, App Store screenshots, release identity, and
`git diff --check`. `npm audit --omit=dev` remains a recorded non-passing
advisory gate with three high transitive findings inside Next's nested
PostCSS/Sharp; the only offered remediation is a forced breaking Next
downgrade, so no dependency change was made.

| Item | Actual result |
|---|---|
| Implementation commits | `50584845dde372b898d8286c26e0bdc1b4377c49` |
| Release/documentation commits | `75c413b93f14665f22cfe6b35d9811f86b0cb15f` plus the release-evidence correction |
| Pull request | [#25](https://github.com/coltonbatts/capturethiscoffee/pull/25), ready, all checks green |
| Merge commit | Pending |
| Production migration | `20260730120000_build13_label_templates_and_closeout.sql` applied to verified project `lehwhehssjfudyrtljus`; postflight passed |
| Production deployment | Pending |
| Signed IPA | Pending |
| App Store Connect build | Pending |
| Internal TestFlight | Pending |
| Physical acceptance | Incomplete until directly observed |
| App Review | Pending |
| Unlisted request | Pending |
| Manual release | Pending |

## External gates

The release must stop for any undiscoverable legal attestation, agreements
acceptance, trader-status decision, tax/banking action, content-rights
assertion, private reviewer identity, or physical observation that cannot be
truthfully established from connected accounts and direct evidence.

No public TestFlight link or public searchable App Store release is authorized.
