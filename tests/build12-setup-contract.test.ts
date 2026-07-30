import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260729120000_build12_native_setup.sql",
  import.meta.url,
);

test("Build 12 setup RPCs retain authenticated invoker/RLS boundaries", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();
  const functions = [
    "setup_add_person_to_roster",
    "setup_create_person",
    "setup_create_person_and_add_to_roster",
    "setup_update_person",
    "setup_create_day",
    "setup_update_day",
    "setup_delete_planning_day",
    "setup_bulk_add_roster",
    "setup_reorder_roster",
    "fetch_day_summaries",
  ];

  assert.doesNotMatch(sql, /security\s+definer/);
  for (const name of functions) {
    const start = sql.indexOf(`create or replace function public.${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const body = sql.slice(start, sql.indexOf("$$;", start) + 3);
    assert.match(body, /security\s+invoker/);
    assert.match(body, /set\s+search_path\s*=\s*''/);
    assert.match(body, /setup_require_authenticated\(\)/);
  }
  assert.match(
    sql,
    /revoke all on function public\.fetch_day_summaries\(\) from public, anon/,
  );
  assert.match(
    sql,
    /grant execute on function public\.fetch_day_summaries\(\) to authenticated/,
  );
  assert.doesNotMatch(sql, /grant execute[^;]*to anon/);
});

test("Build 12 database invariants make roster/order writes atomic", async () => {
  const [sqlValue, schemaValue] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);
  const sql = sqlValue.toLowerCase();
  const schema = schemaValue.toLowerCase();

  assert.match(sql, /people_normalized_name_idx/);
  assert.match(schema, /unique \(production_id, person_id\)/);
  assert.match(sql, /orders_roster_identity_fkey/);
  assert.match(sql, /foreign key \(roster_id, production_id, person_id\)/);
  assert.match(sql, /deferrable initially deferred/g);
  assert.match(sql, /roster member must have exactly one matching initial order/);
  assert.match(sql, /existing roster\/order integrity must be repaired/);
  assert.match(sql, /bulk roster contains duplicate normalized names/);
  assert.match(sql, /roster reorder must include every member exactly once/);
  assert.match(sql, /fetch_day_summaries[\s\S]*limit 2000/);
});

test("Days and frozen web setup use the bounded/atomic contracts", async () => {
  const [workspace, productions, people, roster] = await Promise.all([
    readFile(
      new URL("../mobile/lib/workspace_repository.dart", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/server/operator/productions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/server/operator/people.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/server/operator/roster.ts", import.meta.url),
      "utf8",
    ),
  ]);

  const fetchDaysStart = workspace.indexOf(
    "Future<List<DaySummary>> fetchDays() async",
  );
  const fetchDaysEnd = workspace.indexOf("@override", fetchDaysStart + 1);
  const fetchDays = workspace.slice(fetchDaysStart, fetchDaysEnd);
  assert.match(fetchDays, /rpc\('fetch_day_summaries'\)/);
  assert.doesNotMatch(fetchDays, /from\('(production_roster|orders)'\)/);
  assert.match(productions, /rpc\("setup_create_day"/);
  assert.match(
    productions,
    /p_status:\s*"planning"/,
    "Build 13 web creation must leave room for template assignment before activation",
  );
  assert.match(people, /rpc\("setup_create_person"/);
  assert.match(people, /rpc\("setup_update_person"/);
  assert.match(roster, /rpc\("setup_add_person_to_roster"/);
  assert.match(roster, /rpc\("setup_create_person_and_add_to_roster"/);
});
