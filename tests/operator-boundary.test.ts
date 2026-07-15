import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  normalizeOrderPatch,
  normalizePersonInput,
  normalizeProductionPatch,
  requireId,
  requiredText,
} from "../src/lib/operator-validation";
import { unwrapOperatorAction } from "../src/lib/operator-inputs";

const root = process.cwd();
const operatorDir = join(root, "src/server/operator");
const operatorFiles = allFiles(operatorDir).filter((file) => file.endsWith(".ts"));
const operatorSource = operatorFiles.map(read).join("\n");
const clientFiles = allFiles(join(root, "src")).filter((file) => {
  if (!/\.(ts|tsx)$/.test(file)) return false;
  return /^\s*["']use client["'];/m.test(read(file));
});

describe("operator server boundary", () => {
  it("marks every operator DAL module server-only", () => {
    for (const file of operatorFiles) {
      assert.match(read(file), /import "server-only";/, file);
    }
  });

  it("creates a request-scoped anon-key client and verifies its user", () => {
    const source = read(join(operatorDir, "context.ts"));
    const functionStart = source.indexOf("export async function requireOperatorContext");
    const clientCreation = source.indexOf("createServerClient<Database>");
    assert.ok(functionStart >= 0 && clientCreation > functionStart);
    assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(source, /getVerifiedAppUser\(supabase\)/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|createClient\(/);
    assert.doesNotMatch(operatorSource, /getSupabaseServiceRoleClient/);
  });

  it("keeps every mutation behind the authenticated DAL", () => {
    const actions = read(join(root, "src/app/operator-actions.ts"));
    assert.match(actions, /^"use server";/);
    for (const domain of ["clients", "orders", "people", "productions", "roster"]) {
      assert.match(actions, new RegExp(`@/server/operator/${domain}`));
      assert.match(read(join(operatorDir, `${domain}.ts`)), /requireOperatorContext\(\)/);
    }
    assert.doesNotMatch(actions, /\.from\(|createServerClient|serviceRole/);
  });

  it("loads every operator page through a Server Component shell", () => {
    const routes = [
      ["src/app/productions/page.tsx", "getProductionsPageData"],
      ["src/app/productions/new/page.tsx", "getNewProductionPageData"],
      ["src/app/productions/[id]/page.tsx", "getProductionPageData"],
      ["src/app/people/page.tsx", "getPeoplePageData"],
      ["src/app/labels/page.tsx", "getLabelsPageData"],
    ] as const;
    for (const [path, query] of routes) {
      const source = read(join(root, path));
      assert.doesNotMatch(source, /^["']use client["'];/m, path);
      assert.match(source, new RegExp(`await ${query}\\(`), path);
      assert.match(source, /initialData|NewProductionClient/, path);
    }
  });

  it("parses label deep links in the Server Component and hydrates from props", () => {
    const page = read(join(root, "src/app/labels/page.tsx"));
    const client = read(join(root, "src/app/labels/labels-client.tsx"));
    assert.match(page, /const query = await searchParams/);
    assert.match(page, /requestedProductionId=/);
    assert.match(page, /requestedOrderId=/);
    assert.match(client, /useState\(firstSelection\.productionId\)/);
    assert.doesNotMatch(client, /window\.location\.search|URLSearchParams/);
  });

  it("uses production-scoped board reads", () => {
    const source = read(join(operatorDir, "queries.ts"));
    const scoped = source.slice(source.indexOf("getProductionPageData"));
    assert.match(scoped, /\.from\("production_roster"\)[\s\S]*\.eq\("production_id", id\)/);
    assert.match(scoped, /\.from\("orders"\)[\s\S]*\.eq\("production_id", id\)/);
    assert.match(scoped, /\.eq\("active", true\)/);
    assert.match(scoped, /\.in\("id", rosterPersonIds\)/);
    assert.doesNotMatch(scoped.slice(0, scoped.indexOf("getNewProductionPageData")), /client_people/);
  });

  it("removes browser table CRUD from operator client modules", () => {
    for (const file of clientFiles) {
      const source = read(file);
      assert.doesNotMatch(source, /@\/lib\/data["']|src\/lib\/data\.ts/, file);
      if (file.endsWith("person-photo-upload.ts") || file.endsWith("ui.tsx")) {
        continue;
      }
      assert.doesNotMatch(source, /\.from\(["'](clients|people|client_people|productions|production_roster|orders)["']\)/, file);
    }
    assert.equal(statExists(join(root, "src/lib/data.ts")), false);
  });

  it("keeps share minting server-side and URL construction pure", () => {
    const shareLinks = read(join(root, "src/lib/share-links.ts"));
    const productions = read(join(operatorDir, "productions.ts"));
    assert.doesNotMatch(shareLinks, /getSupabaseBrowserClient|\.rpc\(/);
    assert.match(productions, /\.rpc\("create_production_share_token"/);
  });
});

describe("operator action validation and results", () => {
  it("normalizes whitespace, bounds text, and rejects bad identifiers", () => {
    assert.equal(requiredText("  Shoot day  ", "Name"), "Shoot day");
    assert.equal(requiredText("abcdef", "Name", 3), "abc");
    assert.throws(() => requiredText("   ", "Name"), /Name is required/);
    assert.throws(() => requireId("prod-1", "Production ID"), /invalid/);
    assert.equal(
      requireId("08d08e2e-5318-40dc-a7ac-0f03eee60241", "Production ID"),
      "08d08e2e-5318-40dc-a7ac-0f03eee60241",
    );
  });

  it("normalizes person, production, and order inputs", () => {
    assert.deepEqual(
      normalizePersonInput({ name: "  Ava  ", type: "crew", role: "  DP " }),
      {
        name: "Ava",
        type: "crew",
        role: "DP",
        department: "",
        company: "",
        photo_url: "",
        usual_order: "",
        dietary_notes: "",
        notes: "",
        active: true,
      },
    );
    assert.deepEqual(normalizeProductionPatch({ name: "  Day  ", status: "active" }), {
      name: "Day",
      client_id: undefined,
      new_client_name: undefined,
      shoot_date: undefined,
      location: undefined,
      runner_name: undefined,
      notes: undefined,
      status: "active",
    });
    assert.deepEqual(
      normalizeOrderPatch({ drink_type: "  Latte  ", label_printed: true }),
      { drink_type: "Latte", label_printed: true },
    );
    assert.throws(() => normalizeOrderPatch({}), /No valid order fields/);
  });

  it("unwraps minimal serializable action results without exposing internals", () => {
    assert.deepEqual(unwrapOperatorAction({ ok: true, data: { id: "row-1" } }), {
      id: "row-1",
    });
    assert.throws(
      () => unwrapOperatorAction({ ok: false, error: "Could not save order." }),
      /Could not save order/,
    );
  });
});

function read(file: string) {
  return readFileSync(file, "utf8");
}

function allFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

function statExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
