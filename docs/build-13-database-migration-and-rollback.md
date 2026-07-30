# Build 13 database migration and rollback

Migration: `20260730120000_build13_label_templates_and_closeout.sql`
Verifier: `scripts/verify-build13-database.mjs`
Status: full disposable local replay/lint/verifier passed; not applied to
production.

The Build 13 database change must be additive, replay cleanly from the complete
local history, and target only verified project reference
`lehwhehssjfudyrtljus`.

Before production:

1. Replay the full schema in a disposable local Supabase stack.
2. Run database lint at warning level.
3. Run Build 12 and Build 13 authenticated verifiers.
4. Verify the production ledger and exact dry-run plan.
5. Confirm no unrelated migration is pending.
6. Run read-only compatibility and row-count checks.

Local evidence on 2026-07-30:

- every historical migration plus Build 13 replayed cleanly on disposable
  Supabase CLI `2.109.1`;
- database lint at warning level reported no schema errors;
- the authenticated Build 13 verifier passed anonymous denial, eight canonical
  seeds/default, invalid-content refusal, legacy null/Grid 01 resolution,
  draft/publish immutability, Planning assignment/freeze, valid closeout, and
  completed-state immutability;
- static Build 13 contracts passed 3/3; and
- the migration's embedded catalog bytes exactly match
  `mobile/assets/label_templates/label-templates-v1.json`, SHA-256
  `3c392821d58050529d16db2b2de570a20807ef741e5db5c41338d03e949a01a7`.

This local evidence does not replace the production ledger/plan/read-only
preflight.

Rollback is forward-only unless a reviewed emergency plan proves that removing
new contracts is safe. Web rollback does not undo database state. Published
versions or referenced assignments must never be deleted to simulate rollback;
select a prior published version instead.

## Additive contracts

- `label_templates` owns stable design identities.
- `label_template_versions` owns Draft and immutable Published definitions,
  checksums, authorship, and timestamps.
- `label_template_settings` holds the singleton future-day default.
- `productions.label_template_version_id` snapshots a published version;
  historical `null` rows retain deterministic bundled `grid-01` behavior.
- `productions.completed_at` and `completed_by` record irreversible closeout.

Invited authenticated users retain the existing full-workspace access model.
Anonymous access is revoked. RPCs are security-invoker functions with fixed
empty search paths. Table triggers enforce template validation and lifecycle
rules even when a current client writes directly.

## Lifecycle enforcement

- Published definitions cannot be updated or deleted.
- Only Published versions may become defaults or production assignments.
- Template assignment changes are Planning-only.
- The only forward status transitions are Planning → Active → Complete.
- Complete cannot reopen or be deleted.
- Roster membership/order mutations lock the parent production and fail after
  Complete.
- Closeout atomically locks the production and refuses any on-set `not_asked`
  order or captured order whose label is not printed.

The default is seeded as published `grid-01` version 1. The seven other existing
designs are seeded as published version 1 but are not made the production
default during migration.

## Forward rollback

If the web deployment must be rolled back, leave the additive tables, columns,
policies, and functions in place because Build 12 reads remain compatible.
Restore future-day behavior by selecting a previously reviewed Published
version—normally `grid-01` version 1—as the default. Planning assignments may
be moved to that version. Active/Complete assignments and Published history
must not be rewritten.
