import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProductionRefresh } from "../src/lib/operator-production-load-state";

describe("production dashboard refresh completion", () => {
  it("returns an actionable error when retry receives the same server error", () => {
    assert.deepEqual(
      resolveProductionRefresh(null, null, "Could not load this production."),
      {
        data: null,
        state: "error",
        error: "Could not load this production.",
      },
    );
  });

  it("returns ready with authoritative data after a successful retry", () => {
    const authoritative = { version: 2 };
    assert.deepEqual(resolveProductionRefresh(null, authoritative, ""), {
      data: authoritative,
      state: "ready",
      error: "",
    });
  });

  it("preserves the last usable dashboard after a background refresh failure", () => {
    const current = { version: 1 };
    const result = resolveProductionRefresh(current, null, "Temporary failure.");
    assert.equal(result.data, current);
    assert.equal(result.state, "ready");
    assert.equal(result.error, "Temporary failure.");
  });
});
