import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseProductionOrderPreference,
  reconcileProductionOrderPreference,
} from "../src/lib/production-order-preference";

describe("production order preference", () => {
  it("accepts only arrays of string ids and removes duplicates", () => {
    assert.deepEqual(
      parseProductionOrderPreference('["prod-2","prod-1","prod-2"]'),
      ["prod-2", "prod-1"],
    );
    assert.deepEqual(parseProductionOrderPreference('{"prod-1":true}'), []);
    assert.deepEqual(parseProductionOrderPreference('["prod-1", 2]'), []);
    assert.deepEqual(parseProductionOrderPreference("not json"), []);
  });

  it("removes unknown and deleted production ids", () => {
    assert.deepEqual(
      reconcileProductionOrderPreference(
        ["deleted", "prod-2", "prod-1"],
        ["prod-1", "prod-2", "prod-3"],
      ),
      ["prod-2", "prod-1"],
    );
  });
});
