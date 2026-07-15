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

    enforcePublicApiRateLimit({ request, scope, token: "token", limit: 2 });
    enforcePublicApiRateLimit({ request, scope, token: "token", limit: 2 });
    assert.throws(
      () =>
        enforcePublicApiRateLimit({
          request,
          scope,
          token: "token",
          limit: 2,
        }),
      (error) => error instanceof PublicApiGuardError && error.status === 429,
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
