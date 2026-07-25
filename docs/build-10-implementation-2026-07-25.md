# Capture This Build 10 implementation record

Last updated: 2026-07-25

## Boundary

Build 10 closes the existing-day operating loop in the iOS app:

> Select an existing Active day → collect orders → print labels → continue
> offline → synchronize without losing or silently overwriting work.

Day, people, and roster creation remain online-only future work. The Next.js
site remains a tested fallback and receives no new product surface in this
build. The accepted `niim_blue_flutter: 1.0.1`, M2_H assumptions, and `grid-01`
label geometry are unchanged.

The implementation started from clean `main` at `6e54cc5`. Build 9's exact
committed app source remains `47c4405`.

## Build 9 baseline and release blockers

Build 9 is uploaded, processed, assigned to the internal `Main` group, and has
one signed-in day load plus one physical M2_H reprint recorded. Its automated
baseline was 140 Flutter tests and 104 web tests, with Flutter analysis, web
lint, and web build passing.

All ten Build 9 physical exit checks remain open or only software-tested:

1. force-quit authenticated restoration;
2. airplane-mode authenticated cold start;
3. ten-label batch on the accepted printer and stock;
4. BLE interruption, relaunch, and uncertain-print resolution;
5. printed-but-unsynced **Sync only** recovery without a duplicate;
6. two-account cache and recovery isolation;
7. planning/complete-day physical refusal;
8. device haptics and Reduce Motion;
9. cold-cup adhesion and readability;
10. an independent operator run.

These are release blockers. Build 10 may be implemented and tested locally, but
must not be packaged or uploaded until the physical record is complete.

## Architecture decisions

### One selected-day truth

`BoardController` owns the authenticated selected-day `ProductionBoard`, the
authoritative server snapshot, its optimistic projection, authenticated cache,
outbox replay, and Realtime-triggered refresh. Collect, Print, Home progress,
and the future Summary all read that same projected board.

`WorkspaceController` continues to own signed-in day selection and the unchanged
Legacy-link fallback. `PrinterController` continues to own BLE and physical
print behavior.

### Durable per-order mutation ledger

The Build 9 print-recovery ledger is upgraded into one durable
`OrderMutationOutbox`, keyed by order ID and scoped by signed-in user plus
production. Each record can carry:

- the server `updated_at` observed before the first local order edit;
- a full ordinary-field base snapshot;
- one sparse, coalesced order patch;
- a staged conditional usual-order update;
- a durable explicit conflict;
- an uncertain or confirmed physical-print fact.

Persistence completes before an optimistic edit is exposed. A print-only record
can later acquire an ordinary edit without losing the print fact. Work from a
different signed-in scope is preserved and never coalesced into the current
scope.

Build 9 print evidence is read into the unified ledger on first use. The v2 key
is retained even when empty so a cleared migrated record cannot reappear from
the old v1 key.

### Conditional replay and conflicts

Ordinary order fields use a direct Supabase compare-and-swap:

```text
update orders
set <sparse patch>
where id = <order>
  and production_id = <selected day>
  and updated_at = <revision observed before first local edit>
returning <order>
```

A zero-row result is read back and becomes one of:

- already applied, when every ordinary field equals the intended result;
- safe rebase, when ordinary fields still equal the original base and only a
  non-ordinary fact such as `label_printed` advanced `updated_at`;
- a visible durable conflict, when another device changed an ordinary field;
- missing, when the order no longer exists.

**Use phone version** deliberately rebases the same local intent onto the
displayed server revision and tries once more. **Keep server** discards only the
ordinary local intent. No conflict path silently overwrites the other device.

`people.usual_order` has no revision column. Its optional update is therefore a
second staged intent: first read and compare the observed value, then update
only where the raw current value still matches. A mismatch is a separate visible
usual-order conflict.

### Physical facts

`label_printed` is not part of an ordinary order patch. The app durably records
uncertainty before sending the first physical print packet, promotes it after a
successful task, and replays it independently even when drink fields conflict.
The local optimistic board may display the fact, but recovery is not cleared
until the authoritative server board reports `label_printed: true`.

Migration `20260725120000_preserve_printed_order_facts.sql` adds a trigger that
makes `label_printed: true` irreversible in Postgres. This protects the physical
fact even from a stale full-row write by an older client. The migration has not
been applied to production.

### Refresh behavior

Supabase Realtime is a debounced refresh signal only. Its payload is never
treated as board truth. The existing ten-second polling, app-resume refresh,
pull-to-refresh, and manual sync remain available. A clean disposable local
Supabase stack verified the `public.orders` publication and a filtered
authenticated update signal. The intended private project still requires the
same verification after its reviewed migration application.

### Disposable Supabase evidence

The committed pre-Build-10 schema plus
`20260725120000_preserve_printed_order_facts.sql` and the existing Realtime
publication migration were loaded into a clean local Supabase 2.109.1 stack.
`scripts/verify-build10-local-supabase.mjs` refuses non-local API hosts before
creating its disposable fixture. It verified:

- anonymous order reads are denied and authenticated RLS reads/writes succeed;
- a valid `orders.updated_at` compare-and-swap succeeds;
- a competing authenticated edit makes a stale order write affect zero rows;
- the conditional `people.usual_order` write likewise refuses a stale value;
- a later full-row write cannot weaken `label_printed: true`;
- a filtered authenticated Realtime `UPDATE` signal arrives.

The verifier retries its Realtime stimulus because a newly initialized local
CDC worker can miss the first signal while attaching to its replication slot.
This is consistent with the product contract: Realtime is a best-effort refresh
signal, while polling and manual refresh remain authoritative. The disposable
fixture was removed after the check. No production data or configuration was
used.

## Vertical slices and acceptance tests

| Slice | Implementation acceptance | Automated evidence |
|---|---|---|
| 1. Collect → board → outbox → replay | Accept a usual offline, immediately feed Print, relaunch from cache/outbox, then perform one conditional server write | Controller and widget tests |
| 2. Complete collection surface | Complete selected-day roster; needs-order, captured, no-drink, and setup-needed states; edit and optional usual update | Collect widget and usual-parser tests |
| 3. Conflict safety | Competing server edit remains on the server and stops the local mutation on a visible durable conflict | Controller and Collect conflict tests |
| 4. Print integration | Uncertain fact exists before the physical packet; confirmed fact survives ordinary conflict and is cleared only after authoritative confirmation | Recovery, printer, and controller tests |
| 5. Full offline scenario | Three order captures and two print facts survive a simulated force-quit, replay once after reconnect, and do not replay on the next refresh | Controller acceptance test |
| 6. Refresh and release guardrails | Realtime signals one debounced pull; planning/complete days retain but do not replay pending writes; Legacy remains unchanged | Controller and existing regression tests |

The full user acceptance target still requires a physical iPhone, accepted
M2_H/firmware/stock, a real offline cold start, and a disposable
non-production-project fixture. Automated fakes and the disposable local
database prove orchestration, RLS, conditional-write, monotonic-fact, and
Realtime mechanics; they do not replace that physical run.

Current full regression evidence:

- `flutter analyze` — passed with no issues;
- `flutter test` — 158/158 passed;
- `npm test` — 105/105 passed;
- `npm run lint` — passed;
- `npm run build` — passed on Next.js 16.2.11;
- `npm run verify:niimbot-export` — passed at the unchanged 591×354 contract.
- clean local Supabase verification — passed for RLS, conditional conflict
  refusal, monotonic printed facts, and filtered Realtime.

## Handoff gates

Before any Build 10 archive or upload:

- finish and record all ten Build 9 physical exit checks;
- apply and verify the monotonic printed-fact migration in the intended
  Supabase project;
- verify `public.orders` is in the Supabase Realtime publication;
- run the seven-step Build 10 acceptance target against a disposable fixture;
- rerun Flutter analysis/tests and the frozen web regression suite;
- record source commit, archive identity, IPA hash, signing, and App Store
  Connect status.

No production data mutation, migration application, archive, upload, or push is
authorized by this implementation record.
