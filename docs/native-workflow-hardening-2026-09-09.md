# Native workflow hardening — September 9, 2026

This is implemented working-tree software, not an installed or physically
accepted release. Base commit: `084f80cec9f1a12407883d6346e6c42abebe084a`.
The checked-in version remains `1.0.0+14`; that number alone does not identify
this candidate. The [candidate manifest](native-workflow-candidate-2026-09-09.json)
identifies 187 mobile and migration files, including the new regression suite.
Its source-tree SHA-256 is
`593e1e1205a3a225e85349e75f93b100f1eb17b0388476eb179cc977843ac289`.
Any subsequent source change requires a new manifest and applicable checks.

## State transitions and ownership

| Transition | Owner and authoritative boundary | Failure behavior |
|---|---|---|
| Restore identity → select day | `SessionController` → `WorkspaceController` → `BoardController.activate`; per-user selection/cache | Network refresh failure retains identity. Explicit invalid-session refusal disables the session. Generation checks reject stale setup, selection, board replay and refresh results; delayed legacy restoration cannot replace authenticated activation. |
| Online setup → roster | `SetupController` / `SetupRepository`; authenticated setup RPCs; deferred roster/order integrity triggers | Publish after acknowledged writes only. Clearing setup invalidates pending results and signed-photo URL results. No setup outbox. |
| Capture → durable intent → projected board | `BoardController.saveOrder` → serialized `OrderMutationOutbox` write → overlay | Publish local intent after persistence. Failed writes do not commit in-memory intent. Corrupt outbox activation reports a blocked state instead of escaping startup. |
| Intent → ordinary replay | Fetch live Active day; sparse `updated_at` conditional order update; optionally conditional usual update | Conflict retains local intent. Lost response with matching ordinary state is acknowledged. A newer local edit is rebased onto the acknowledged earlier write and remains pending. A newer usual edit retains its intent and uses the acknowledged usual as its base. |
| Print tap → render → uncertainty | `PrinterController` action lock; shared renderer; durable `uncertain` before `PrinterTransport.printPage` | Recheck workspace generation and day availability after rendering and after persistence. Persistence failure sends zero print tasks. Day closure during persistence retains uncertainty and sends zero tasks. |
| Uncertainty → transport completion | M2_H adapter initialization → one page, quantity one → finish polling | Init/page/finish failures, disconnect, timeout, backgrounding and late completion preserve uncertainty. Outstanding transport/teardown prevents reconnect. No automatic retry. |
| Transport completion → confirmed fact | Persist `printedNeedsSync` | Failed confirmation persistence retains the earlier uncertainty. A protocol completion is not proof of usable physical paper. |
| Confirmed fact → server acknowledgement → cleanup | Independent `label_printed: true` replay; scoped recovery reconciliation | Ordinary conflicts cannot discard confirmed print facts. Cached printed flags cannot acknowledge refused sync. Another account's board cannot clear recovery. Server cleanup rechecks that the stored state is confirmed, never uncertain. |
| Operator inspection → recovery | Existing Recovery screen and printer action lock | “Label printed” performs sync only. “Nothing printed” requires explicit retry and successful cleanup. Restart, polling, reconnect and resume never authorize retransmission. |
| Refusal → blocked board | Authenticated board/write refusals and template RPC authorization refusals | Refusals stop replay and capture/print eligibility. Authenticated cache retains a refusal after successful cache persistence; offline reactivation retains the block. Successful authoritative refresh can clear it. |
| Summary → closeout → Complete | Dialog rechecks scope and current blockers; `BoardController.completeDay` drains replay, checks pending local writes and freezes this client's edits; repository validates RPC response | Server remains final authority. Lost/rejected closeout requires a live refresh before further work. Valid acknowledgement marks Complete even if subsequent fetching fails. Fractional or malformed counts cannot validate completion. |

The outbox is a whole-ledger, serialized durable store keyed by order ID, with
explicit account/day ownership checks. Ordinary fields and print state coexist
in a record but have separate acknowledgement/retirement paths. A record for
another account blocks reuse of that order ID rather than overwriting evidence.

## Demonstrated defects and regression evidence

Every defect below was reproduced as a failing test before its fix. The main
suite is [`workflow_races_test.dart`](../mobile/test/workflow_races_test.dart).
Its completers stop execution at specific asynchronous boundaries without
random delays; its 12-case replay/restart matrix crosses uncertainty/confirmation,
old server printed flags, and successful/unreachable/refused fetches while an
ordinary order conflicts.

| Reproduction before fix | Result after fix |
|---|---|
| Select day; hold selection persistence; sign out; release write | Original board stays deactivated. |
| Hold an order response; save a newer local drink; release | Newer drink reaches server instead of being retired with the first write. |
| Hold usual response; edit usual again; release | Own earlier save becomes the new base, rather than a false competing conflict. |
| Order write refused after a successful board fetch, with a print fact queued | Board blocked; no further print-fact dispatch. |
| Cached server printed=true; queue confirmation; next fetch refused | Sync reports pending and retains evidence. |
| Restore a refused board while offline | Persisted refusal remains blocked. |
| Confirmed recovery belongs to account A; account B reads the same printed order | Account A's record survives reconciliation. |
| Call server cleanup against uncertain storage | Both legacy and shared ledgers preserve uncertainty. |
| Setup creation finishes after setup clear | No private person is restored and no successful result is returned. |
| Session refresh finishes after sign-out | Identity remains signed out. Explicit invalid-session refusal also disables stale work. |
| Template RPC returns expired-JWT refusal after earlier board reads succeeded | Refusal reaches board guard instead of becoming a fallback success. |
| Legacy startup read finishes after authenticated activation | Authenticated workspace remains selected. |
| Outbox read is corrupt during activation | Blocked startup state, no board fetch or print permission. |
| Stale conflict action targets another account's pending order | Action rejected; original intent retained. |
| Closeout response lost; subsequent board fetch offline | Work remains blocked pending authoritative refresh. |
| Closeout returns fractional nonzero counts | Invalid response rejected. |

Two additional UI/print boundary regressions reproduce:

- [`summary_screen_test.dart`](../mobile/test/summary_screen_test.dart): pending
  capture added while the confirmation dialog is open prevents RPC dispatch.
- [`printer_failure_boundaries_test.dart`](../mobile/test/printer_failure_boundaries_test.dart):
  day closure during preflight persistence prevents transmission.

The held replay account-switch test also protects against stale response
publication. Existing tests continue to cover failed preflight/confirmation/
cleanup persistence, restart, corrupt preferences, transport phase failures,
timeout followed by late success, disconnect, background/resume, sync-only task
counts, and print facts surviving ordinary conflicts.

## Verification and limits

- Flutter 3.44.4 / Dart 3.12.2; `flutter analyze --no-pub`: no issues.
- `flutter test --no-pub --reporter expanded`: **271 passed**, including
  existing physical-label and App Store screenshot goldens; no baseline updates.
  The new regression files/cases add 32 tests, including the 12-case matrix.
- `node --import tsx --test tests/build13-database-contract.test.ts`: 3 passing
  source-contract checks. These inspect SQL; they are not live database tests.
- `git diff --check`: clean. No dependency, firmware, renderer, label baseline,
  signing or Supabase migration changes.

Source inspection shows `complete_production_day` locks the production and the
lifecycle trigger checks on-set order state. Child mutation triggers acquire
the same parent lock and reject completed-day writes. Deferred setup integrity
triggers require exactly one matching order per roster entry. The intended
serialization is: replay wins the lock and closeout validates its result, or
closeout wins and replay is refused with local intent retained. Lock contention,
transaction isolation, RLS and deployed migration identity still require the
existing [`verify-build13-database.mjs`](../scripts/verify-build13-database.mjs)
and concurrent-client validation against a disposable local Supabase instance.
Docker's daemon was unavailable; neither a local Supabase CLI nor `psql` was
available. No production database was mutated or claimed verified.

The software establishes ordering relative to storage API acknowledgements and
transport futures. It cannot guarantee filesystem flush through device power
loss, recover erased/corrupt bytes, retract BLE bytes already handed to the
plugin, or know whether paper actually emerged. Refusal caching is best-effort:
failed cache persistence cannot establish restart durability. Recovery storage
failure blocks printing, and corrupt recovery bytes are retained. Offline
clients cannot observe another client's closeout until communication returns;
no server can validate unsent intent on another offline phone. These are explicit
limits on the invariant evidence, not physical acceptance passes.

## Exact-candidate physical and integration matrix

Status of every row: **NOT RUN**. Run on the installed build made from this
manifest, using fictional people/orders. Before starting, record archive/IPA
SHA-256, visible version/build, install source/time, manifest match, iPhone
model/iOS, M2_H asset and existing firmware, ribbon/stock lot, 50×30 mm dimensions,
density 3, template version/checksum, and operator/observer. Do not substitute
prior Build 13 observations. Preserve `niim_blue_flutter: 1.0.1`, quantity one,
M2_H and existing firmware. For each row record attempts, observed paper count,
app recovery state after relaunch, server order/fact, timestamps and sanitized
evidence. Any unexplained extra label fails the row.

| Row | Controlled interruption / combination | Required observations |
|---|---|---|
| P1 | Online setup, capture, preview, one print, sync, closeout | One matching usable label; correct order printed fact; authoritative Complete. Independent operator repeats journey. |
| P2 | Offline capture, terminate/relaunch before reconnect | All acknowledged captures retained in correct account/day; cached template renders; sync sends no print tasks. |
| P3 | Terminate before/during preflight persistence | No transmission without acknowledged uncertainty; after ambiguous interruption inspect paper before recovery. |
| P4 | Disconnect separately during init, page transfer, finish/feed | No automatic second label; uncertainty survives relaunch; capture any partially emitted paper. Repeat with Bluetooth off and printer power loss. |
| P5 | Timeout then late printer completion; rapid taps/reconnect attempts | At most one deliberate task; late completion cannot erase uncertainty or enable premature reconnect; inspect actual paper. |
| P6 | Paper emerges; terminate before confirmation storage, then before server sync | First case remains uncertain; second is sync-only. Relaunch/reconnect never prints automatically. |
| P7 | Confirmed print + competing remote drink edit + sync failure | Ordinary conflict remains visible; print fact ultimately persists independently; resolving conflict produces no label. |
| P8 | Existing printed=true; explicit reprint; disconnect; relaunch | Old server flag cannot erase new uncertainty. Exercise both truthful inspection choices on separate fixtures. |
| P9 | Account/day switch while render, persistence, transmission and sync are pending | No stale board/people publication or later cross-scope dispatch; original recovery retained. Return to original account/day to resolve. |
| P10 | Expired auth with no network, then explicit server refusal | Offline expiration alone preserves isolated cache; refusal blocks work; successful cached refusal persistence retains block at relaunch. |
| P11 | Low-storage/rejected write and corrupt recovery fixture on a disposable device | Failed preflight produces zero tasks; confirmation/cleanup failure retains evidence; corruption blocks printing without erasing bytes. Do not corrupt a working production phone. |
| P12 | Open closeout dialog, introduce local pending work; also race another client's replay/roster mutation with closeout | Dialog recheck refuses local pending state; server rejects incomplete closeout or late mutation. Record real transaction outcomes; do not infer them from mocks. |
| P13 | Lose closeout response, then lose refresh connectivity | Printing stays blocked until server status is authoritatively recovered; no optimistic return to Active. |
| P14 | Background/resume and force-quit around each phase; repeat sync-only recovery | No automatic transmission, correct reconnect lock, truthful durable state; physically distinguish success and uncertainty haptics. |
| P15 | Short/long fictional names/drinks, every assigned template, actual cold cups | Preview/paper match, crop/orientation/feed/readability/density/adhesion accepted; no incidental renderer baseline changes. |

Use the older [physical worksheet](build-13-physical-acceptance-worksheet-2026-07-30.md)
for its additional operational checks, but create new candidate observations.
Archive/upload, device installation, Apple approval and physical acceptance are
separate remaining release gates.
