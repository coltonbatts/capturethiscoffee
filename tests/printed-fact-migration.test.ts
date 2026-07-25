import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("orders preserve label_printed as a monotonic physical fact", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260725120000_preserve_printed_order_facts.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    sql,
    /new\.label_printed\s*=\s*old\.label_printed\s+or\s+new\.label_printed/i,
  );
  assert.match(sql, /before update of label_printed on public\.orders/i);
});
