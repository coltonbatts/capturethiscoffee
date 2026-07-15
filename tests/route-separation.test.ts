import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  isProtectedOperatorPath,
  legacyRunnerRedirectUrl,
} from "../src/lib/route-access";

describe("operator and runner route separation", () => {
  it("redirects a legacy token link to the runner route and preserves its query", () => {
    const redirect = legacyRunnerRedirectUrl(
      new URL(
        "https://coffee.example/productions/prod-1?token=runner%20token&source=qr",
      ),
    );

    assert.equal(
      redirect?.toString(),
      "https://coffee.example/run/prod-1?token=runner%20token&source=qr",
    );
  });

  it("does not classify operator, setup, or nested API URLs as legacy links", () => {
    assert.equal(
      legacyRunnerRedirectUrl(
        new URL("https://coffee.example/productions/prod-1"),
      ),
      null,
    );
    assert.equal(
      legacyRunnerRedirectUrl(
        new URL("https://coffee.example/productions/new?token=token"),
      ),
      null,
    );
    assert.equal(
      legacyRunnerRedirectUrl(
        new URL(
          "https://coffee.example/api/public/productions/prod-1?token=token",
        ),
      ),
      null,
    );
  });

  it("protects operator pages while leaving the token runner route public", () => {
    assert.equal(isProtectedOperatorPath("/productions/prod-1"), true);
    assert.equal(isProtectedOperatorPath("/productions"), true);
    assert.equal(isProtectedOperatorPath("/run/prod-1"), false);
    assert.equal(isProtectedOperatorPath("/api/public/productions/prod-1"), false);
  });

  it("keeps token selection and CoffeeData out of the runner client boundary", () => {
    const operatorPage = readFileSync(
      new URL("../src/app/productions/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    const runnerPage = readFileSync(
      new URL("../src/app/run/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    const runnerBoard = readFileSync(
      new URL("../src/app/run/[id]/runner-board.tsx", import.meta.url),
      "utf8",
    );
    const runnerHook = readFileSync(
      new URL("../src/app/run/[id]/use-runner-board.ts", import.meta.url),
      "utf8",
    );

    assert.doesNotMatch(operatorPage, /useSearchParams|shareToken/);
    assert.match(runnerPage, /validateProductionShareToken/);
    assert.doesNotMatch(runnerHook, /CoffeeData|loadCoffeeData/);
    assert.doesNotMatch(
      runnerBoard,
      /AddToRoster|ProductionDetailsEditor|RosterEditor|RunnerLinkSheet|mintProductionShareLink/,
    );
  });

  it("keeps every public runner and printer read behind token validation", () => {
    const publicReads = [
      [
        "../src/app/api/public/productions/[id]/route.ts",
        "getProductionBoard(supabase, id)",
      ],
      [
        "../src/app/api/public/productions/[id]/labels/route.ts",
        "getPrinterProductionData(supabase, id)",
      ],
      [
        "../src/app/api/public/orders/[id]/label/route.ts",
        "getOrderLabelContext(supabase, productionId, orderId)",
      ],
    ] as const;

    for (const [path, protectedRead] of publicReads) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      const validation = source.indexOf("validateProductionShareToken(");
      const read = source.indexOf(protectedRead);
      assert.ok(validation >= 0, `${path} must validate a share token`);
      assert.ok(read > validation, `${path} must validate before reading data`);
      assert.match(source, /error instanceof ShareTokenError/);
    }
  });

  it("keeps public order patches token-scoped and board-scoped", () => {
    const source = readFileSync(
      new URL("../src/app/api/public/orders/[id]/route.ts", import.meta.url),
      "utf8",
    );
    const validation = source.indexOf("validateProductionShareToken(");
    const orderRead = source.indexOf('.from("orders")');

    assert.ok(validation >= 0);
    assert.ok(orderRead > validation, "token validation must precede order access");
    assert.match(source, /sanitizeRunnerOrderPatch\(body\?\.patch\)/);
    assert.match(source, /isRunnerOrderOnBoard\(order, roster, productionId\)/);
    assert.match(source, /\.eq\("production_id", productionId\)/);
    assert.match(source, /production\.status !== "active"/);
  });
});
