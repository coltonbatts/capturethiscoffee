import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase";
import {
  hashProductionShareToken,
  sanitizeRunnerOrderPatch,
  ShareTokenError,
  validateProductionShareToken,
} from "../src/lib/production-share";

type TokenRow = {
  id: string;
  production_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/**
 * Minimal stand-in for the two query shapes validateProductionShareToken
 * uses: select().eq().eq().maybeSingle() and update().eq().
 */
function stubSupabase(row: TokenRow | null, updates: unknown[] = []) {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: row, error: null }),
          };
        },
        update(patch: unknown) {
          updates.push(patch);
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

async function expectTokenError(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ShareTokenError);
    assert.equal(error.status, status);
    return true;
  });
}

describe("production share access helpers", () => {
  it("hashes share tokens without storing the raw URL secret", () => {
    assert.equal(
      hashProductionShareToken("runner-token"),
      createHash("sha256").update("runner-token").digest("hex"),
    );
    assert.notEqual(hashProductionShareToken("runner-token"), "runner-token");
  });

  it("keeps token-scoped order writes to operational fields only", () => {
    assert.deepEqual(
      sanitizeRunnerOrderPatch({
        drink_type: "Latte",
        status: "confirmed",
        production_id: "other-production",
        person_id: "person-2",
        label_printed: true,
        created_at: "2026-06-01T00:00:00.000Z",
      }),
      {
        drink_type: "Latte",
        status: "confirmed",
        label_printed: true,
      },
    );

    assert.deepEqual(sanitizeRunnerOrderPatch({ status: "archived" }), {});
  });

  it("normalizes null field values to empty strings and drops non-strings", () => {
    assert.deepEqual(
      sanitizeRunnerOrderPatch({
        special_notes: null,
        vendor: undefined,
        size: 12,
        drink_type: "Drip",
      }),
      {
        special_notes: "",
        vendor: "",
        drink_type: "Drip",
      },
    );
    assert.deepEqual(sanitizeRunnerOrderPatch("drink_type=Latte"), {});
    assert.deepEqual(sanitizeRunnerOrderPatch(null), {});
  });

});

describe("validateProductionShareToken", () => {
  const validRow: TokenRow = {
    id: "token-1",
    production_id: "prod-1",
    expires_at: null,
    revoked_at: null,
  };

  it("rejects a missing or blank token before querying", async () => {
    await expectTokenError(
      validateProductionShareToken(stubSupabase(validRow), "prod-1", "   "),
      401,
    );
    await expectTokenError(
      validateProductionShareToken(stubSupabase(validRow), "", "runner-token"),
      401,
    );
  });

  it("rejects an unknown token", async () => {
    await expectTokenError(
      validateProductionShareToken(stubSupabase(null), "prod-1", "wrong-token"),
      403,
    );
  });

  it("rejects a revoked token", async () => {
    await expectTokenError(
      validateProductionShareToken(
        stubSupabase({ ...validRow, revoked_at: "2026-06-30T00:00:00.000Z" }),
        "prod-1",
        "runner-token",
      ),
      403,
    );
  });

  it("rejects an expired token", async () => {
    await expectTokenError(
      validateProductionShareToken(
        stubSupabase({ ...validRow, expires_at: "2020-01-01T00:00:00.000Z" }),
        "prod-1",
        "runner-token",
      ),
      403,
    );
  });

  it("accepts a live token and stamps last_used_at", async () => {
    const updates: unknown[] = [];
    const row = {
      ...validRow,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };

    const result = await validateProductionShareToken(
      stubSupabase(row, updates),
      "prod-1",
      "runner-token",
    );

    assert.equal(result.id, "token-1");
    assert.equal(updates.length, 1);
    assert.ok(
      typeof updates[0] === "object" &&
        updates[0] !== null &&
        "last_used_at" in updates[0],
    );
  });
});
