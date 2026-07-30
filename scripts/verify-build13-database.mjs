#!/usr/bin/env node

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY from a disposable local Supabase instance.",
  );
}
const parsedUrl = new URL(url);
if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname)) {
  throw new Error("Refusing to run Build 13 verification against a non-local URL.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const anonymous = createClient(url, anonKey, options);
const email = `build13-${Date.now()}@example.test`;
const password = `Fictional-${Date.now()}-Only!`;
let userId;

function data(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

function expectError(result, label) {
  assert.ok(result.error, `${label} should fail`);
  return result.error;
}

try {
  expectError(
    await anonymous.rpc("resolve_label_template_for_production", {
      p_production_id: crypto.randomUUID(),
    }),
    "anonymous template resolution",
  );
  expectError(
    await anonymous.rpc("complete_production_day", {
      p_production_id: crypto.randomUUID(),
    }),
    "anonymous closeout",
  );

  const createdUser = data(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fixture: "build-13-fictional" },
    }),
    "create disposable user",
  );
  userId = createdUser.user.id;
  const operator = createClient(url, anonKey, options);
  data(
    await operator.auth.signInWithPassword({ email, password }),
    "sign in disposable operator",
  );

  const templates = data(
    await operator
      .from("label_template_versions")
      .select("id,version,status,definition,definition_checksum,label_templates!inner(slug)")
      .eq("status", "published"),
    "load seeded templates",
  );
  assert.equal(templates.length, 8);
  const grid = templates.find(
    (entry) => entry.label_templates.slug === "grid-01" && entry.version === 1,
  );
  assert.ok(grid, "Grid 01 v1 must be seeded");

  const settings = data(
    await operator
      .from("label_template_settings")
      .select("default_version_id")
      .single(),
    "load template settings",
  );
  assert.equal(settings.default_version_id, grid.id);

  const invalidDefinition = structuredClone(grid.definition);
  invalidDefinition.elements[0].href = "https://example.test/forbidden";
  expectError(
    await operator.rpc("create_label_template_draft", {
      p_slug: `invalid-${Date.now()}`,
      p_display_name: "Invalid Verifier Template",
      p_definition: invalidDefinition,
    }),
    "executable or remote template content",
  );

  const dayPayload = data(
    await operator.rpc("setup_create_day", {
      p_name: "Build 13 Fictional Day",
      p_client_name: "Northstar Fictional",
      p_shoot_date: "2026-08-05",
      p_status: "planning",
      p_seed_default_roster: false,
    }),
    "create planning day",
  );
  const productionId = dayPayload.production.id;
  assert.equal(dayPayload.production.label_template_version_id, grid.id);

  data(
    await operator
      .from("productions")
      .update({ label_template_version_id: null })
      .eq("id", productionId),
    "simulate historical null template snapshot",
  );
  const legacyResolution = data(
    await operator.rpc("resolve_label_template_for_production", {
      p_production_id: productionId,
    }),
    "resolve historical fallback",
  );
  assert.equal(legacyResolution.template_slug, "grid-01");
  assert.equal(legacyResolution.version, 1);
  assert.equal(legacyResolution.legacy_fallback, true);

  const draft = data(
    await operator.rpc("create_label_template_draft", {
      p_slug: `verify-${Date.now()}`,
      p_display_name: "Verifier Template",
      p_description: "Disposable local verification only.",
      p_definition: grid.definition,
      p_changelog: "Initial local verifier draft.",
    }),
    "create a draft",
  );
  assert.equal(draft.status, "draft");

  const published = data(
    await operator.rpc("publish_label_template_version", {
      p_version_id: draft.id,
    }),
    "publish draft",
  );
  assert.equal(published.status, "published");
  expectError(
    await operator
      .from("label_template_versions")
      .update({ changelog: "Forbidden published edit" })
      .eq("id", published.id),
    "published immutability",
  );

  const assigned = data(
    await operator.rpc("assign_label_template_to_production", {
      p_production_id: productionId,
      p_version_id: published.id,
    }),
    "assign planning template",
  );
  assert.equal(assigned.label_template_version_id, published.id);

  const person = data(
    await operator.rpc("setup_create_person", {
      p_name: `Build Thirteen Fiction ${Date.now()}`,
      p_type: "crew",
      p_active: true,
    }),
    "create fictional roster person",
  );
  const rosterPayload = data(
    await operator.rpc("setup_add_person_to_roster", {
      p_production_id: productionId,
      p_person_id: person.id,
      p_group_label: "Camera",
      p_on_set_today: true,
    }),
    "add fictional roster person",
  );
  const orderId = rosterPayload.order.id;

  data(
    await operator
      .from("productions")
      .update({ status: "active" })
      .eq("id", productionId),
    "activate production",
  );
  expectError(
    await operator.rpc("assign_label_template_to_production", {
      p_production_id: productionId,
      p_version_id: grid.id,
    }),
    "active template reassignment",
  );
  expectError(
    await operator.rpc("complete_production_day", {
      p_production_id: productionId,
    }),
    "closeout with on-set Not asked",
  );

  data(
    await operator
      .from("orders")
      .update({ status: "confirmed", drink_type: "Latte" })
      .eq("id", orderId),
    "capture order",
  );
  expectError(
    await operator.rpc("complete_production_day", {
      p_production_id: productionId,
    }),
    "closeout with captured unprinted order",
  );
  data(
    await operator
      .from("orders")
      .update({ label_printed: true })
      .eq("id", orderId),
    "record printed fact",
  );
  const completed = data(
    await operator.rpc("complete_production_day", {
      p_production_id: productionId,
    }),
    "complete production",
  );
  assert.equal(completed.production.status, "complete");
  assert.ok(completed.production.completed_at);
  assert.equal(completed.not_asked, 0);
  assert.equal(completed.captured_unprinted, 0);

  expectError(
    await operator
      .from("orders")
      .update({ special_notes: "Forbidden after closeout" })
      .eq("id", orderId),
    "completed order mutation",
  );
  expectError(
    await operator
      .from("productions")
      .update({ status: "active" })
      .eq("id", productionId),
    "completed production reopen",
  );
  expectError(
    await operator.from("productions").delete().eq("id", productionId),
    "completed production deletion",
  );

  process.stdout.write(
    "Build 13 database verification passed: 8 seeds, legacy Grid 01 fallback, draft/publish/assign, strict lifecycle, closeout, and immutable completed state.\n",
  );
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
