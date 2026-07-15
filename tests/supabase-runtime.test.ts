import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  resolveSupabasePublicConfig,
  resolveSupabaseServiceConfig,
} from "../src/lib/supabase-config";
import { buildProductionShareUrl } from "../src/lib/share-url";

describe("Supabase runtime configuration", () => {
  it("returns actionable, sanitized errors for missing and malformed public config", () => {
    const missing = resolveSupabasePublicConfig(undefined, undefined);
    assert.equal(missing.status, "error");
    assert.match(missing.error, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(missing.error, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(missing.error, /restart the app/i);

    const rawUrl = "not-a-url-with-private-detail";
    const rawKey = "sentinel-anon-key-that-must-not-leak";
    const malformed = resolveSupabasePublicConfig(rawUrl, rawKey);
    assert.equal(malformed.status, "error");
    assert.doesNotMatch(malformed.error, new RegExp(rawUrl));
    assert.doesNotMatch(malformed.error, new RegExp(rawKey));
  });

  it("keeps trusted server configuration independent from the operator anon key", () => {
    const configured = resolveSupabaseServiceConfig(
      "https://example.supabase.co",
      "server-only-service-role-key",
    );

    assert.equal(configured.status, "configured");
  });

  it("removes the browser CRUD module instead of falling back to local data", () => {
    assert.equal(
      sourceFilesFor(join(process.cwd(), "src/lib")).some((file) =>
        file.endsWith("/data.ts"),
      ),
      false,
    );
  });

  it("keeps capability URL construction independent of operator auth config", () => {
    assert.equal(
      buildProductionShareUrl("https://coffee.example", "prod-1", "token-1"),
      "https://coffee.example/run/prod-1?token=token-1",
    );
  });
});

describe("runtime source boundaries", () => {
  const sourceFiles = allFiles(join(process.cwd(), "src")).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
  const combinedSource = sourceFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  it("contains no CoffeeData local persistence backend or demo bypass", () => {
    for (const obsolete of [
      "saveCoffeeData",
      "resetDemoCoffeeData",
      "isSupabaseBacked",
      "isAuthDisabled",
      "NEXT_PUBLIC_ENABLE_AUTH",
      "capture-this-coffee-data-v1",
    ]) {
      assert.doesNotMatch(combinedSource, new RegExp(obsolete));
    }
    assert.equal(
      sourceFiles.some((file) => /lib\/(storage|seed)\.ts$/.test(file)),
      false,
    );
  });

  it("retains only non-authoritative localStorage preferences", () => {
    const localStorageFiles = sourceFiles.filter((file) =>
      readFileSync(file, "utf8").includes("localStorage"),
    );
    assert.deepEqual(
      localStorageFiles
        .map((file) => file.replace(`${process.cwd()}/`, ""))
        .sort(),
      [
        "src/app/labels/labels-client.tsx",
        "src/app/productions/productions-client.tsx",
      ],
    );
    assert.match(combinedSource, /capture-this-coffee-production-order/);
    assert.match(combinedSource, /ctc-label-design/);
  });

  it("keeps runner and service-role code out of the operator client boundary", () => {
    const runnerHook = readFileSync(
      join(process.cwd(), "src/app/run/[id]/use-runner-board.ts"),
      "utf8",
    );
    const serviceRole = readFileSync(
      join(process.cwd(), "src/lib/supabase-server.ts"),
      "utf8",
    );

    assert.doesNotMatch(runnerHook, /@\/lib\/data["']/);
    assert.match(runnerHook, /@\/lib\/data-errors/);
    assert.match(serviceRole, /import "server-only"/);
    assert.doesNotMatch(
      serviceRole,
      /getSupabaseBrowserClient|supabaseConfigError/,
    );
    assert.doesNotMatch(combinedSource, /["']use client["'];?[\s\S]{0,500}@\/server\//);
  });

  it("guards every operator route on the server as well as in Proxy", () => {
    for (const route of ["productions", "people", "labels"]) {
      const layout = readFileSync(
        join(process.cwd(), `src/app/${route}/layout.tsx`),
        "utf8",
      );
      assert.match(layout, /requireServerOperatorUser/);
    }

    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    assert.doesNotMatch(proxy, /\/run\/:path/);
    assert.doesNotMatch(proxy, /\/api\/public/);
  });
});

function allFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

function sourceFilesFor(directory: string): string[] {
  return allFiles(directory).filter((file) => /\.(ts|tsx)$/.test(file));
}
