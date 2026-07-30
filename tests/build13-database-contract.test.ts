import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260730120000_build13_label_templates_and_closeout.sql",
  import.meta.url,
);
const catalogUrl = new URL(
  "../mobile/assets/label_templates/label-templates-v1.json",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8")).toLowerCase();
}

test("Build 13 template and closeout RPCs retain authenticated invoker boundaries", async () => {
  const sql = await migrationSql();
  const rpcNames = [
    "create_label_template_draft",
    "update_label_template_draft",
    "publish_label_template_version",
    "set_default_label_template_version",
    "assign_label_template_to_production",
    "resolve_label_template_for_production",
    "complete_production_day",
  ];

  for (const name of rpcNames) {
    const start = sql.indexOf(`create or replace function public.${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const body = sql.slice(start, sql.indexOf("$$;", start) + 3);
    assert.match(body, /security\s+invoker/);
    assert.match(body, /set\s+search_path\s*=\s*''/);
    assert.match(body, /setup_require_authenticated\(\)/);
    assert.match(
      sql,
      new RegExp(
        `revoke all on function public\\.${name}\\([^;]+from public, anon`,
      ),
    );
  }
  assert.doesNotMatch(sql, /grant execute[^;]*to anon/);
});

test("Build 13 database triggers enforce immutable templates and closeout", async () => {
  const sql = await migrationSql();

  assert.match(sql, /published label template versions are immutable/);
  assert.match(sql, /template status may only move from draft to published/);
  assert.match(sql, /new productions must begin in planning/);
  assert.match(sql, /label template is frozen after planning/);
  assert.match(sql, /only planning productions can be deleted/);
  assert.match(sql, /production status must move planning to active to complete/);
  assert.match(sql, /zero on-set not asked and zero captured unprinted orders/);
  assert.match(sql, /completed production roster and orders are immutable/);
  assert.match(
    sql,
    /before insert or update or delete on public\.production_roster/,
  );
  assert.match(sql, /before insert or update or delete on public\.orders/);
  assert.match(sql, /for update/);
});

test("Build 13 declarative templates are bounded and seeded from the canonical catalog", async () => {
  const [sqlValue, catalogValue] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(catalogUrl, "utf8"),
  ]);
  const sql = sqlValue.toLowerCase();
  const seedMatch = sqlValue.match(
    /\$label_catalog\$(.*?)\$label_catalog\$/s,
  );
  assert.ok(seedMatch, "migration must embed a generated canonical catalog");
  assert.equal(
    seedMatch[1],
    catalogValue,
    "migration seed bytes must exactly match the canonical catalog",
  );
  assert.deepEqual(JSON.parse(seedMatch[1]), JSON.parse(catalogValue));

  assert.match(sql, /template definition exceeds 64 kib/);
  assert.match(sql, /template definition must contain between 1 and 96 elements/);
  assert.match(sql, /text must contain between 1 and 8 segments/);
  assert.match(sql, /schema 1, 591x354, black or white/);
  assert.match(sql, /orbitglobe/);
  assert.match(sql, /sparkle4/);
  assert.match(sql, /personname/);
  assert.match(sql, /ordernumber/);
  assert.match(sql, /cannot contain urls or executable content/);
  assert.match(sql, /template\.slug = 'grid-01'/);
  assert.match(sql, /v_legacy_fallback/);
});
