import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enforcePublicApiRateLimit,
  PublicApiGuardError,
  readLimitedJsonRequest,
  rejectOversizedJsonRequest,
} from "../src/lib/public-api-guard";

describe("public API guard", () => {
  it("allows the configured request count and then rejects the bucket", () => {
    const request = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.20" },
    });
    const scope = `test-${Math.random()}`;

    enforcePublicApiRateLimit({ request, scope, limit: 2 });
    enforcePublicApiRateLimit({ request, scope, limit: 2 });
    assert.throws(
      () =>
        enforcePublicApiRateLimit({
          request,
          scope,
          limit: 2,
        }),
      (error) => error instanceof PublicApiGuardError && error.status === 429,
    );
  });

  it("does not let one client bypass the limit by rotating fake tokens", () => {
    const requestForToken = (token: string) =>
      new Request(`https://example.test/api?token=${token}`, {
        headers: { "x-forwarded-for": "203.0.113.21" },
      });
    const scope = `token-rotation-${Math.random()}`;

    enforcePublicApiRateLimit({
      request: requestForToken("wrong-token-1"),
      scope,
      limit: 2,
    });
    enforcePublicApiRateLimit({
      request: requestForToken("wrong-token-2"),
      scope,
      limit: 2,
    });
    assert.throws(
      () =>
        enforcePublicApiRateLimit({
          request: requestForToken("wrong-token-3"),
          scope,
          limit: 2,
        }),
      (error) => error instanceof PublicApiGuardError && error.status === 429,
    );
  });

  it("keeps the in-memory limiter bounded during a same-window bucket flood", () => {
    const scope = `bucket-flood-${Math.random()}`;
    const now = Date.now();
    const firstRequest = new Request("https://example.test/api", {
      headers: { "x-forwarded-for": "198.51.0.0" },
    });

    for (let index = 0; index <= 5_000; index += 1) {
      enforcePublicApiRateLimit({
        request: new Request("https://example.test/api", {
          headers: {
            "x-forwarded-for": `198.51.${Math.floor(index / 256)}.${index % 256}`,
          },
        }),
        scope,
        limit: 1,
        now,
      });
    }

    assert.doesNotThrow(() =>
      enforcePublicApiRateLimit({
        request: firstRequest,
        scope,
        limit: 1,
        now,
      }),
    );
  });

  it("rejects an oversized declared JSON body", () => {
    const request = new Request("https://example.test/api", {
      method: "PATCH",
      headers: { "content-length": "9000" },
    });
    assert.throws(
      () => rejectOversizedJsonRequest(request, 8192),
      (error) => error instanceof PublicApiGuardError && error.status === 413,
    );
  });

  it("rejects an oversized chunked JSON body after reading", async () => {
    const request = new Request("https://example.test/api", {
      method: "PATCH",
      body: JSON.stringify({ value: "x".repeat(9000) }),
    });
    await assert.rejects(
      () => readLimitedJsonRequest(request, 8192),
      (error) => error instanceof PublicApiGuardError && error.status === 413,
    );
  });
});
