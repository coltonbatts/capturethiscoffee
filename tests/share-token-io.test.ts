import assert from "node:assert/strict";
import { it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase";
import { validateProductionShareToken } from "../src/lib/production-share";

// Real PostgREST request serialization, with a fictional in-memory endpoint.
// No credentials or network access are used. This models compare-and-set;
// it does not claim to exercise PostgreSQL row locks or deployed RLS.
function fixture(lastUsedAt: string | null) {
  const row = {
    id: "00000000-0000-4000-8000-000000000001",
    production_id: "00000000-0000-4000-8000-000000000002",
    expires_at: null as string | null,
    revoked_at: null as string | null,
    last_used_at: lastUsedAt,
  };
  let reads = 0;
  let attempts = 0;
  let writes = 0;
  const client = createClient<Database>("https://fictional.example.test", "fictional-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/rest/v1/production_share_tokens");
        if (init?.method === "GET") {
          reads++;
          assert.equal(url.searchParams.get("production_id"), `eq.${row.production_id}`);
          assert.match(url.searchParams.get("token_hash")!, /^eq\.[a-f0-9]{64}$/);
          assert.ok(url.searchParams.get("select")?.includes("last_used_at"));
          return Response.json({ ...row });
        }
        assert.equal(init?.method, "PATCH");
        attempts++;
        assert.equal(url.searchParams.get("id"), `eq.${row.id}`);
        const expected = row.last_used_at === null ? "is.null" : `eq.${row.last_used_at}`;
        if (url.searchParams.get("last_used_at") === expected) {
          row.last_used_at = JSON.parse(String(init.body)).last_used_at;
          writes++;
        }
        return new Response(null, { status: 204 });
      },
    },
  });
  return {
    row,
    validate: () => validateProductionShareToken(client, row.production_id, "fictional-token"),
    counts: () => ({ reads, attempts, writes }),
  };
}

it("360 ten-second polls validate every time but write usage only 12 times", async (t) => {
  let now = Date.parse("2026-09-10T12:00:00.000Z");
  t.mock.method(Date, "now", () => now);
  const f = fixture(null);
  for (let poll = 0; poll < 360; poll++) {
    await f.validate();
    now += 10_000;
  }
  assert.deepEqual(f.counts(), { reads: 360, attempts: 12, writes: 12 });
});

for (const previous of [null, "2026-09-10T11:00:00.123456+00:00"]) {
  it(`coalesces concurrent usage writes for ${previous === null ? "unused" : "stale"} tokens`, async (t) => {
    t.mock.method(Date, "now", () => Date.parse("2026-09-10T12:00:00.000Z"));
    const f = fixture(previous);
    await Promise.all(Array.from({ length: 8 }, () => f.validate()));
    assert.equal(f.counts().reads, 8);
    assert.ok(f.counts().attempts > 1, "exercise competing stale snapshots");
    assert.equal(f.counts().writes, 1);
    await f.validate();
    assert.equal(f.counts().writes, 1);
  });
}

it("recent usage never bypasses revocation or expiration checks", async (t) => {
  const now = Date.parse("2026-09-10T12:00:00.000Z");
  t.mock.method(Date, "now", () => now);
  const f = fixture(new Date(now).toISOString());
  await f.validate();
  f.row.revoked_at = new Date(now).toISOString();
  await assert.rejects(f.validate(), /Invalid production share token/);
  f.row.revoked_at = null;
  f.row.expires_at = new Date(now).toISOString();
  await assert.rejects(f.validate(), /Expired production share token/);
  assert.deepEqual(f.counts(), { reads: 3, attempts: 0, writes: 0 });
});

it("future usage timestamps do not cause repeated writes during clock skew", async (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-09-10T12:00:00.000Z"));
  const f = fixture("2026-09-10T12:01:00.000Z");
  await f.validate();
  assert.deepEqual(f.counts(), { reads: 1, attempts: 0, writes: 0 });
});
