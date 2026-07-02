import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductionShareUrl } from "../src/lib/share-links";

describe("buildProductionShareUrl", () => {
  it("builds the runner URL shape the iOS app parses", () => {
    const url = buildProductionShareUrl(
      "https://coffee.capturethis.com",
      "08d08e2e-5318-40dc-a7ac-0f03eee60241",
      "abc123",
    );
    assert.equal(
      url,
      "https://coffee.capturethis.com/productions/08d08e2e-5318-40dc-a7ac-0f03eee60241?token=abc123",
    );
  });

  it("strips trailing slashes from the origin", () => {
    const url = buildProductionShareUrl("https://example.com/", "prod-1", "t");
    assert.equal(url, "https://example.com/productions/prod-1?token=t");
  });

  it("URL-encodes the production id and token", () => {
    const url = buildProductionShareUrl("https://example.com", "a/b", "t&x=1");
    assert.equal(url, "https://example.com/productions/a%2Fb?token=t%26x%3D1");
  });
});
