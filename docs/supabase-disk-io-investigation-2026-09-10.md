# Supabase Disk I/O investigation — September 10, 2026

Project: `lehwhehssjfudyrtljus`. This is a source investigation and locally tested
patch, not a measurement of production or a claim that the alert has cleared.
No production queries, migrations, deployments, dashboard changes, or billing
changes were performed. No Supabase connector is available in this session.
Current compute, deployed schema/code, traffic, and alert-window metrics remain
unverified. Existing uncommitted mobile workflow changes were preserved.

## Findings ranked by confidence

Confidence below describes the source mechanism; attribution to the alert still
requires time-correlated dashboard evidence.

1. **High: public read traffic caused writes.**
   `src/lib/production-share.ts` updated `production_share_tokens.last_used_at`
   after every successful validation, including every runner board GET.
   `src/app/run/[id]/use-runner-board.ts` polls every ten seconds. One continuously
   polling runner therefore generated roughly 360 bookkeeping updates/hour,
   even with no orders changed. Multiple clients sharing a token multiply that
   load. Updates generate tuple/WAL churn and later vacuum work. This does not
   affect the normal authenticated Flutter path, which bypasses public APIs;
   if there was no public/Legacy link traffic during the alert, this cannot be
   its cause. A handful of small updates alone does not establish budget exhaustion.
2. **High mechanism, medium attribution: refresh amplification.**
   Flutter `workspace_controller.dart` polls every ten seconds; each
   `workspace_repository.dart` board load makes up to five scoped table reads
   plus template resolution. That is up to 2,160 requests/hour per foreground
   device before Realtime and mutation refreshes. Realtime is debounced 250 ms;
   board refreshes are single-flight. Polling stops on paused/detached lifecycle
   states, but the order subscription itself remains until selection teardown.
   The web operator hook refreshes its Server Component every ten seconds and on
   each order event without an explicit debounce. Its page DAL reloads all active
   people alongside the scoped roster. Both web polling timers lack a hidden-tab
   guard (browser throttling is not a dependable application policy). Confirm
   actual client concurrency, background traffic, and event bursts before tuning.
3. **Medium: broad reads, sorts, and growing history.**
   `src/server/operator/queries.ts` loads entire orders tables for the production
   list and entire people/roster/orders tables for label export, using `select('*')`.
   This is request fan-out, not a per-person N+1 in board loading: mobile/public
   boards batch people IDs. Mobile setup people reads are bounded at 1,000, but
   sort by name. `fetch_day_summaries()` aggregates all history before its final
   2,000-row limit; bounded response size does not bound work. These warrant
   scoped/paginated follow-up only if actual cardinalities and buffers justify it.
4. **Low without live metrics: cache pressure, swap, maintenance or other jobs.**
   No checked-in Edge Functions directory, cron registration, or recurring SQL
   HTTP job was found. This does not establish what is deployed externally.
   Inspect database/system traffic, backups, autovacuum, WAL retention, jobs,
   and separately deployed functions. The burst budget concerns I/O capacity,
   not simply the amount of disk space used. Supabase identifies memory/swap,
   low cache hit rate, inefficient queries and traffic volume as possible causes.
   [Supabase high-I/O guide](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)

Other write paths were reviewed: native outbox intent is coalesced and revision
checked; conflicts stop ordinary replay; confirmed print facts replay separately;
`markLabelPrinted` only updates rows where `label_printed = false`, then verifies
an already-printed row by reading it. There is no evidence supporting removal of
these correctness safeguards. Failed replay can retry on subsequent refreshes
and traverse remaining records; measure failed-request bursts before adding
backoff. Web order updates still write timestamps for repeated identical input,
and `setup_reorder_roster` updates every supplied row, including unchanged
positions. These are secondary churn candidates if frequent in production.
Lifecycle triggers lock the parent day and enforce immutability; integrity checks
use roster identity and production/order keys. Keep these safety checks intact.

## Exact patch and behavior

- `src/lib/production-share.ts`: include the existing `last_used_at` column in
  the authenticated token lookup; write usage only when null or at least five
  minutes old. Conditional `IS NULL` or equality against the observed timestamp
  prevents concurrent instances with the same stale snapshot from all updating.
  Every request still reads the token and checks production scope, hashing,
  revocation and expiry. There is no in-process authorization cache.
- `tests/production-share.test.ts`: adapt existing token fixtures and query stub
  to the conditional bookkeeping write.
- `tests/share-token-io.test.ts`: use the real Supabase client against a fictional
  in-memory HTTP endpoint to verify 360 polls/12 writes, concurrent null and stale
  snapshots, timestamp precision in filters, expiry/revocation after a recent use,
  and future timestamps during clock skew.
- This report records the remaining investigation and acceptance procedure.

`last_used_at` now records approximate activity, normally less than five minutes
behind the most recent successful use, rather than every request. Failed usage
writes can leave it older, as before. No source consumer treats it as access
control. The simulated reduction is 96.7% of bookkeeping writes for one polling
client, **not** 96.7% of project disk I/O. Concurrent stale requests can still send
conditional PATCH requests; only one changes the row. Results depend on ordinary
server clock synchronization and all serving instances running the new code.
No schema, RLS, grants, printing, label output, or mobile code was changed. No
migration is required. The existing token primary key supports the conditional
write; a `last_used_at` index would add avoidable maintenance.

## Queries and indexes to confirm

Use deployed definitions and representative plans, not migration filenames, as
proof of the current database. Do not add all candidate indexes preemptively.

| Flow | Existing source coverage / question | Evidence needed before changing |
| --- | --- | --- |
| Token lookup by hash + production | Unique `token_hash`; usage update uses token PK | Check deployed unique index and token-table update/WAL deltas |
| Orders by production | Unique `(production_id, roster_id)` and `(production_id, status)` support filtering | Does sort by `updated_at` (mobile) or `created_at` (web) spill? Consider `(production_id, updated_at)` or `(production_id, created_at)` only for material measured cost; indexing `updated_at` increases write work and can prevent HOT updates |
| Roster by production, ordered by position | Unique `(production_id, person_id)` and production index support filtering | Consider `(production_id, sort_order)` only if sort/buffer cost warrants it |
| People by ID | Primary key, batched `IN` | Confirm no large/truncated board responses; no extra ID index needed |
| Setup people `ORDER BY name` | GIN full-text name index and normalized-name unique index do not satisfy raw name ordering | Measure rows/sort; consider B-tree name ordering with stable pagination as separate work |
| Day summaries | Production/roster/order keys exist; history aggregated before limit | Compare calls, total execution, shared reads and temp blocks; an outer Function Scan hides internal plans |
| Roster deletion and person FK checks | Orders unique key begins with production, not roster; person-only FK indexes are absent in base schema | Examine actual delete/FK plans before considering `orders(roster_id)` or person FK indexes; setup deletes are not established hot paths |
| RLS | Latest checked-in full-access policies are `TO authenticated USING (true)`; anonymous grants revoked | Verify deployed policies/migrations; do not optimize historical admin policies or bypass RLS |

## Dashboard investigation checklist

1. Open the [project dashboard](https://supabase.com/dashboard/project/lehwhehssjfudyrtljus).
   Confirm the project ref. Record the alert timestamp with timezone, deployed
   application version, and existing compute/disk settings without editing them.
2. Open **Observability → Database Health** and select the alert interval plus
   24 hours and seven days for comparison. Record Disk IO budget consumption,
   read/write throughput (MB/s), read/write IOPS, latency/I/O wait, CPU, memory,
   cache hit rate and swap activity where available. Distinguish a short burst
   from sustained load and depletion followed by throttling. If swap detail is
   unavailable, use an already configured metrics/Grafana view or request it from
   support; do not infer swap-in/out activity from allocated swap alone.
3. In **Query Performance**, rank by total execution time and calls, then shared
   blocks read, dirtied/written, and temporary blocks. Inspect token validation
   and usage updates, production-scoped board reads, whole-table web reads,
   `fetch_day_summaries`, and Realtime/system queries. Correlate request counts
   with public versus native traffic. View sensitive query text only privately;
   export query IDs and aggregate counters, not SQL literals, URLs or bindings.
4. In the SQL editor, collect the read-only counters below twice across a
   representative interval. Use deltas without resetting shared statistics.
   Confirm index validity, table sizes and dead-tuple/vacuum trends. A high seq
   scan count on a tiny cached table is not by itself a missing-index finding.
5. Inspect plans for the leading candidates using plain `EXPLAIN` first. In a
   disposable fixture database, use `EXPLAIN (ANALYZE, BUFFERS)` with realistic
   fictional cardinalities and authenticated RLS context. Match the actual
   projection, predicates and ordering. A service-role plan can hide RLS costs.
   For a PL/pgSQL RPC, inspect its internal SELECT separately. Production read
   `ANALYZE` should be time-bounded and deliberately scheduled; never execute
   mutation RPCs or `EXPLAIN ANALYZE UPDATE/DELETE` as a diagnostic shortcut.
6. Check database logs for repeated failures, long transactions and lock waits;
   check autovacuum/checkpoints, backup timing, replication lag/retained WAL,
   deployed Edge Functions and Cron jobs. Keep log bodies and payloads private.
   Do not run `VACUUM FULL`, rebuild indexes, reset stats or change settings as
   part of evidence collection.
7. After a separately authorized deployment of this code, compare equal-load
   windows. Expect token updates to fall toward 12/hour per continuously used
   token (plus old instances/other writers until rollout completes). Validate
   revocation and expiry using fictional staging tokens. Confirm public board
   access and label-export access still work. No production change occurred in
   this investigation.
8. Reassess throughput, IOPS, swap activity, temp spills, error rates and p95
   latency after the known churn is removed. If token traffic was absent, pursue
   the actual top consumers instead of attributing improvement to this patch.

### Read-only SQL worksheet (not executed against production)

These queries return counters/metadata rather than private rows. Keep even these
results in the owner's private incident record. Extension schema and version
vary; resolve the namespace first and replace `extensions` below if necessary.
If the extension is missing, record that gap rather than enabling it here.

```sql
select n.nspname as extension_schema, e.extversion
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pg_stat_statements';

-- Query text intentionally omitted. Inspect it privately by queryid as needed.
select queryid, calls, total_exec_time, mean_exec_time, rows,
       shared_blks_hit, shared_blks_read,
       shared_blks_dirtied, shared_blks_written,
       temp_blks_read, temp_blks_written
from extensions.pg_stat_statements
where dbid = (select oid from pg_database where datname = current_database())
order by shared_blks_read desc
limit 20;
-- Repeat ranking by total_exec_time, calls, and temp_blks_written.
-- If supported by the installed version, inspect wal_bytes as well.

select now() as sampled_at, stats_reset, blks_read, blks_hit,
       temp_files, temp_bytes, deadlocks
from pg_stat_database where datname = current_database();

select relname, n_live_tup, n_dead_tup, seq_scan, idx_scan,
       n_tup_ins, n_tup_upd, n_tup_del, n_tup_hot_upd,
       last_autovacuum, last_autoanalyze,
       pg_total_relation_size(relid) as total_bytes
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;

select t.relname as table_name, i.relname as index_name,
       x.indisvalid, x.indisready, pg_get_indexdef(i.oid) as definition
from pg_index x
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
join pg_class i on i.oid = x.indexrelid
where n.nspname = 'public'
order by t.relname, i.relname;
```

Shared block reads can be served by the operating-system cache and are not a
one-to-one count of physical disk reads. Correlate them with disk metrics.
Statistics are cumulative and may reset on restart; do not subtract samples
across a reset. Query text may include secrets even when generally normalized.

## Compute decision and estimated trade-offs

**No upgrade is established as necessary from the available evidence.** The
warning makes capacity worth investigating, but source inspection cannot identify
the installed tier or prove that an upgrade fixes the dominant workload.
An upgrade is justified if representative post-fix demand repeatedly exceeds
current sustained IOPS/throughput with falling burst budget and correlated
latency/errors, or active swap/cache misses show the working set needs more RAM.
Fix dominant scan/spill/churn problems first where feasible. Choose the smallest
size with sustained headroom for measured peaks; do not size against burst maxima.

For example only, if currently Micro, Small raises the published baseline from
11 to 22 MB/s and 500 to 1,000 IOPS, with 1 to 2 GB RAM. Medium offers 43 MB/s,
2,000 IOPS and 4 GB RAM. Effective limits also depend on the provisioned disk;
upgrades entail downtime, typically under two minutes but potentially longer.
[Compute specifications](https://supabase.com/docs/guides/platform/compute-and-disk)

Published compute-only estimates are approximately $10/month Micro, $15 Small,
and $60 Medium: roughly +$5/month Micro→Small or +$45/month Small→Medium, before
plan charges, credits, taxes and other usage. Billing is hourly; these are
conditional comparisons, not a quote for this uninspected project. More RAM can
reduce reads from cache misses; more compute cannot eliminate needless writes.
[Compute pricing](https://supabase.com/docs/guides/platform/manage-your-usage/compute)

## Verification

- All 121 web tests pass, including the five new I/O regressions.
- `npm run lint` passes.
- Focused strict ES2017 TypeScript check of the helper and both affected test
  files passes.
- Full `npx tsc --noEmit --incremental false` is blocked by the pre-existing
  dotAll `/s` regex at `tests/build13-database-contract.test.ts:73`, incompatible
  with the repository's ES2017 target. Confirmed present in HEAD; left untouched.
- PostgreSQL/Supabase integration was not run: Docker daemon is unavailable.
  HTTP tests exercise actual client serialization with modeled conditional
  updates, not real row locking or deployed RLS.
- No Flutter or label code changed; no physical-print claim is made. Production
  deployment, actual I/O improvement and the dashboard confirmations remain open.
