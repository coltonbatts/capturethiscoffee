# Build 12 native setup — draft implementation

Date: 2026-07-29
Lane: `codex/build-12-native-setup` only
Release identity: unchanged at `1.0.0+11`

This is implementation and automated evidence for the Build 12 draft. It has
not been deployed, uploaded, assigned to testers, or applied to production
Supabase. It does not change or satisfy Build 11's physical/external-pilot
acceptance gate.

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

## Explicit non-claims

- No production migration or production data change was performed.
- No web or iOS deployment was performed.
- No build number/version was changed.
- No printer dependency, firmware assumption, label geometry, density, print
  flow, or recovery behavior was changed.
- No physical printer acceptance is claimed or required for this draft.
- Build 11's physical/external-pilot gate remains open and unchanged.
