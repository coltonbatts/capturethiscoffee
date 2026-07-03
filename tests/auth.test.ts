import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { User } from "@supabase/supabase-js";
import { isAdminAppUser, isAuthenticatedAppUser } from "../src/lib/auth";

function makeUser(appMetadata: Record<string, unknown> = {}): User {
  return {
    id: "user-1",
    app_metadata: appMetadata,
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

describe("isAdminAppUser", () => {
  it("rejects missing users", () => {
    assert.equal(isAdminAppUser(null), false);
    assert.equal(isAdminAppUser(undefined), false);
  });

  it("grants full access to any signed-in user without admin metadata", () => {
    assert.equal(isAdminAppUser(makeUser()), true);
  });

  it("still grants access to users with legacy admin metadata", () => {
    assert.equal(isAdminAppUser(makeUser({ admin: true })), true);
    assert.equal(isAdminAppUser(makeUser({ staff: true })), true);
    assert.equal(isAdminAppUser(makeUser({ role: "admin" })), true);
  });
});

describe("isAuthenticatedAppUser", () => {
  it("mirrors user presence", () => {
    assert.equal(isAuthenticatedAppUser(null), false);
    assert.equal(isAuthenticatedAppUser(makeUser()), true);
  });
});
