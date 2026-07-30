# Build 12 native setup — release candidate

Date: 2026-07-29
Lane: `codex/build-12-native-setup`
Release identity: `1.0.0+12`

The implementation and automated evidence below were completed before release.
The release outcome is recorded separately so upload or automation evidence is
not confused with physical-printer acceptance. Selecting and distributing
Build 12 does not change or satisfy Build 11's physical/external-pilot
acceptance gate.

## Release outcome — 2026-07-29

| Item | Actual result |
|---|---|
| Implementation branch | `codex/build-12-native-setup` |
| Implementation commits | `36a4674`, `e1b00ee`, `2a58d98` |
| Release-identity commit | `0ce06c7e13ba5f3b80ba367e595fbfcabceb6ee9` |
| Review | [PR #23](https://github.com/coltonbatts/capturethiscoffee/pull/23), ready PR with Web, Mobile, Mobile screenshots, Vercel, and GitGuardian green |
| Merge | Squash-merged normally to `main` as `88dcf1f346525cd7eed5dfb32be1499fe66855e1` |
| Production database | Project ref `lehwhehssjfudyrtljus`; migration `20260729120000_build12_native_setup.sql` applied and verified |
| Frozen web fallback | Vercel deployment `dpl_FxzFQcJ3VZt73fcYezsyAjh53puF` reached READY from the merge SHA; `https://coffee.capturethis.com` public pages returned 200, protected pages redirected to sign-in, and no new runtime errors were present |
| Signed iOS artifact | Built from the merge SHA; `1.0.0 (12)`, bundle `com.capturethis.ctcprinter`, team `YW8K4837YB`, Apple Distribution/App Store profile, 23,577,290-byte IPA, SHA-256 `c190ba71f9e0110de1d9e55df3e0a0e77dc79303006686e387ec659831f42c76` |
| App Store Connect | Upload succeeded; processing completed; binary state Validated; non-exempt encryption No |
| Internal TestFlight | Assigned only to the existing `Main` internal group (`44678fa3-60ec-4971-9c1a-73b768e8a198`), with one existing tester; App Store Connect subsequently reported that tester installed `1.0.0 (12)` |

The production preflight found zero normalized-name duplicate groups, zero
duplicate roster memberships, zero roster rows without exactly one matching
order, and zero inconsistent order/roster relationships. It also exposed a
historical migration-ledger mismatch: production had one noncanonical bootstrap
entry even though the audited schema matched local migration effects through
`20260706120000`, and the additive
`20260725120000_preserve_printed_order_facts.sql` trigger was genuinely absent.
With explicit release authorization, the ledger was reconciled to the 14
verified pre-Build-12 files and that one missing additive trigger migration was
applied. No production record was repaired or deleted. A second plan check then
showed only `20260729120000` pending and no unexpected remote version.

Build 12 was applied from the exact checked-in SQL file in one transaction.
Postflight found all 14 expected functions, `security invoker` on every setup
function, fixed empty search paths, no `public` or `anon` execute grants,
intended `authenticated` grants, the validated composite foreign key, and both
deferred integrity triggers. An authenticated read returned the bounded day
summary and all pre-Build-12 table reads with unchanged production counts:
6 clients, 4 people, 1 production, 2 roster rows, and 2 orders.

The final local release gate passed:

- `npm run lint`;
- `npm run test` — 108 passing;
- `npm run build`;
- `npm run verify:niimbot-export`;
- `flutter analyze`;
- `flutter test` — 182 passing;
- `flutter build ios --simulator --no-codesign`;
- release identity plus App Store screenshots — 9 passing;
- signed archive/export validation for version, build, bundle, team,
  provisioning, camera/photo/Bluetooth declarations, privacy manifests,
  release entitlements, the production Supabase URL, and the public `anon`
  credential.

## Product result

An invited signed-in operator can now stay on iPhone for pre-production:

`Sign in → Days → day details → People → setup roster → bulk review → atomic commit → select day → Collect / Print`

The native flow supports:

- creating and editing a Planning, Active, or Complete day and its optional
  client/brand relationship;
- server-enforced deletion of Planning days only, with a destructive
  confirmation;
- dense people search plus create, edit, archive/unarchive, usual order, role,
  department, company, private dietary notes, and general notes;
- camera or photo-library selection, an 8 MB image limit, private
  `person-photos` upload, stable storage references, and signed display URLs;
- adding an existing person, quick-create-and-add, removal, on-set state,
  groups, and atomic drag reorder;
- newline/comma bulk paste, whitespace normalization, case-insensitive
  deduplication, archived/already-rostered resolution, preview, and a single
  atomic commit for up to 200 reviewed entries;
- an explicit handoff into the unchanged selected-day `ProductionBoard` used by
  Collect, Print, progress, offline order edits, conflicts, and recovery.

All setup mutations are online-only. The controller does not optimistically
apply any rejected write, and setup work is not placed in the operational order
outbox.

## Architecture

| Concern | Owner | Persistence / contract |
|---|---|---|
| Auth/session | `SessionController` | Existing Supabase session/Keychain behavior |
| Day selection and authoritative board | `WorkspaceController` | Existing `ProductionBoard`, board cache, and selected-day pointer |
| Online setup | `SetupController` + `SetupRepository` | Authenticated Supabase reads and atomic `setup_*` functions |
| Operational edits | `BoardController` | Existing conditional outbox and conflict model |
| Printing and physical facts | `PrinterController` | Existing NIIMBOT/recovery path; unchanged |

`fetchDays()` now calls `fetch_day_summaries()` rather than downloading every
production, roster row, and order. Dart validates status, IDs, dates,
non-negative integer counts, impossible progress relationships, a one-million
per-day count bound, and a 2,000-row response bound.

## Additive database contract

Migration:
`supabase/migrations/20260729120000_build12_native_setup.sql`

The migration adds:

- normalized-name uniqueness for people;
- a composite roster/order relationship foreign key;
- deferred constraint triggers requiring exactly one matching order for every
  committed roster row;
- an upgrade preflight that fails safely if existing roster/order integrity
  needs repair;
- authenticated, invoker-rights functions with fixed empty `search_path`:
  `setup_create_day`, `setup_update_day`, `setup_create_person`,
  `setup_delete_planning_day`, `setup_update_person`,
  `setup_add_person_to_roster`,
  `setup_create_person_and_add_to_roster`, `setup_bulk_add_roster`,
  `setup_reorder_roster`, and `fetch_day_summaries`;
- the existing usual-order parsing behavior for initial order drafts.

The functions are explicitly revoked from `public` and `anon`, granted only to
`authenticated`, and continue to use the existing RLS policies. There are no
`security definer` functions.

The frozen web fallback now calls the same atomic create/person/roster
contracts. Its screens and product scope were not redesigned.

Before this migration is considered for any shared environment, run a read-only
audit for normalized duplicate names and roster rows without exactly one
matching order. The migration intentionally refuses to silently choose a repair.

## Automated evidence

Focused tests cover:

- RPC authorization/static boundary checks, grants, invoker rights, fixed
  search paths, composite integrity, and deferred triggers;
- empty/planning/active/complete/large/malformed day-summary results;
- setup DTO relationships and invalid data;
- 40-person bulk normalization with whitespace and case variants;
- duplicate person and roster-membership rejection;
- atomic in-memory success/rollback and no optimistic success after failure;
- retryable online-required controller and widget states;
- native create-day navigation, reviewed bulk UI, and selection back into the
  existing Collect and Print home;
- compatibility of setup-created identities and initial orders with
  `ProductionBoard` and `PrinterQueue`;
- all pre-existing offline order, conflict, printing, recovery, label, and web
  tests.

The disposable local Postgres/Supabase verification additionally executes:

1. anonymous RPC rejection;
2. invited-style email/password authentication;
3. day/client creation plus server-enforced Planning-only deletion;
4. private photo upload and signed read;
5. person create/edit/archive and normalized duplicate rejection;
6. frozen-web default-roster compatibility plus a forced mid-seed day/client
   creation rollback;
7. atomic existing-person and quick-create roster writes;
8. a rejected direct roster row without an order;
9. a forced mid-bulk duplicate failure with full rollback;
10. a 40-person bulk commit with exactly one roster row and order per person;
11. atomic reorder, group/on-set update, removal, and order cascade;
12. rejection of Active-day deletion and active/complete day summary
    aggregation.

Run that verifier only against a local disposable stack:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=LOCAL_ANON_KEY \
SUPABASE_SERVICE_ROLE_KEY=LOCAL_SERVICE_ROLE_KEY \
npm run verify:build12-setup
```

The script refuses any URL whose host is not `127.0.0.1`, `localhost`, or
`::1`. It creates only fictional records and removes them when complete.

## Release boundaries and warnings

- Nothing was assigned to the existing external group, no tester was invited,
  and no public TestFlight link was created.
- The build was not submitted for external beta review, App Store review, or
  release to App Store customers.
- Flutter continues to emit its non-blocking CocoaPods-to-SPM migration notice;
  the checked-in dependency setup was not changed for this release.
- No printer dependency, firmware assumption, label geometry, density, print
  flow, or recovery behavior was changed.
- No physical printer acceptance is claimed from automation, upload,
  processing, assignment, or installation.
- Build 11's physical/external-pilot gate remains open and unchanged.
