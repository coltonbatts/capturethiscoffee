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
  throw new Error("Refusing to run Build 12 verification against a non-local URL.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const anonymous = createClient(url, anonKey, options);
const email = `build12-${Date.now()}@example.test`;
const password = `Fictional-${Date.now()}-Only!`;
const createdProductionIds = [];
const createdPersonIds = [];
const createdClientIds = [];
let userId;
let photoPath;

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
    await anonymous.rpc("fetch_day_summaries"),
    "anonymous day summary access",
  );
  expectError(
    await anonymous.rpc("setup_create_day", {
      p_name: "Anonymous Fictional Day",
    }),
    "anonymous setup mutation",
  );

  const createdUser = data(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fixture: "build-12-fictional" },
    }),
    "create disposable user",
  );
  userId = createdUser.user.id;

  const operator = createClient(url, anonKey, options);
  data(
    await operator.auth.signInWithPassword({ email, password }),
    "sign in disposable operator",
  );

  const dayPayload = data(
    await operator.rpc("setup_create_day", {
      p_name: "Build 12 Fictional Shoot",
      p_client_name: "Northstar Fictional",
      p_shoot_date: "2026-08-04",
      p_location: "Stage 12",
      p_runner_name: "Taylor Fiction",
      p_notes: "Disposable local verification only.",
      p_status: "planning",
      p_seed_default_roster: false,
    }),
    "create day atomically",
  );
  const productionId = dayPayload.production.id;
  const clientId = dayPayload.client.id;
  createdProductionIds.push(productionId);
  createdClientIds.push(clientId);
  assert.equal(dayPayload.production.client_id, clientId);

  const disposablePlanningDay = data(
    await operator.rpc("setup_create_day", {
      p_name: "Disposable Planning Day",
      p_client_id: clientId,
      p_status: "planning",
      p_seed_default_roster: false,
    }),
    "create planning day for safe deletion",
  );
  const deletedPlanningId = data(
    await operator.rpc("setup_delete_planning_day", {
      p_production_id: disposablePlanningDay.production.id,
    }),
    "delete planning day",
  );
  assert.equal(deletedPlanningId, disposablePlanningDay.production.id);
  const deletedPlanningRows = data(
    await operator
      .from("productions")
      .select("id")
      .eq("id", disposablePlanningDay.production.id),
    "verify planning day deletion",
  );
  assert.equal(deletedPlanningRows.length, 0);

  photoPath = `fictional/build12-${Date.now()}.png`;
  data(
    await operator.storage
      .from("person-photos")
      .upload(photoPath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        contentType: "image/png",
        upsert: false,
      }),
    "upload private fictional photo",
  );
  const stablePhotoReference = operator.storage
    .from("person-photos")
    .getPublicUrl(photoPath).data.publicUrl;
  assert.match(
    stablePhotoReference,
    /\/storage\/v1\/object\/public\/person-photos\//,
  );
  const signedPhoto = data(
    await operator.storage
      .from("person-photos")
      .createSignedUrl(photoPath, 60),
    "sign private fictional photo",
  );
  assert.match(signedPhoto.signedUrl, /token=/);

  const person = data(
    await operator.rpc("setup_create_person", {
      p_name: "Avery Stone",
      p_type: "crew",
      p_role: "Camera operator",
      p_department: "Camera",
      p_company: "Fictional Unit",
      p_photo_url: stablePhotoReference,
      p_usual_order: "Large, Iced latte, Oat milk, Half sweet",
      p_dietary_notes: "Fictional private note",
      p_notes: "Fictional general note",
      p_active: true,
    }),
    "create person",
  );
  createdPersonIds.push(person.id);

  expectError(
    await operator.rpc("setup_create_person", {
      p_name: "  avery   stone ",
    }),
    "normalized duplicate person",
  );

  const editedPerson = data(
    await operator.rpc("setup_update_person", {
      p_person_id: person.id,
      p_name: person.name,
      p_type: "crew",
      p_role: "Director of photography",
      p_department: "Camera",
      p_company: "Fictional Unit",
      p_photo_url: stablePhotoReference,
      p_usual_order: person.usual_order,
      p_dietary_notes: person.dietary_notes,
      p_notes: "Edited fictional note",
      p_active: true,
    }),
    "edit person",
  );
  assert.equal(editedPerson.role, "Director of photography");

  data(
    await operator.from("client_people").insert({
      client_id: clientId,
      person_id: person.id,
      relationship_notes: "Fictional fallback seed verification",
      active: true,
    }),
    "link fictional person for fallback seed",
  );
  const seededFallbackDay = data(
    await operator.rpc("setup_create_day", {
      p_name: "Frozen Web Compatibility Day",
      p_client_id: clientId,
      p_status: "active",
      p_seed_default_roster: true,
    }),
    "create fallback-compatible seeded day",
  );
  createdProductionIds.push(seededFallbackDay.production.id);
  const seededRoster = data(
    await operator
      .from("production_roster")
      .select("id,person_id")
      .eq("production_id", seededFallbackDay.production.id),
    "verify fallback-compatible seed",
  );
  const seededOrders = data(
    await operator
      .from("orders")
      .select("id,roster_id,person_id")
      .eq("production_id", seededFallbackDay.production.id),
    "verify fallback-compatible initial order",
  );
  assert.equal(seededRoster.length, 1);
  assert.equal(seededRoster[0].person_id, person.id);
  assert.equal(seededOrders.length, 1);
  assert.equal(seededOrders[0].roster_id, seededRoster[0].id);
  assert.equal(seededOrders[0].person_id, person.id);

  const seedFailurePerson = data(
    await operator
      .from("people")
      .insert({
        name: "AAA Fictional Seed Failure",
        type: "crew",
        department: "X".repeat(201),
        active: true,
      })
      .select()
      .single(),
    "create disposable seed failure person",
  );
  createdPersonIds.push(seedFailurePerson.id);
  expectError(
    await operator.rpc("setup_create_day", {
      p_name: "Rollback Fictional Day",
      p_client_name: "Rollback Fictional Client",
      p_status: "active",
      p_seed_default_roster: true,
    }),
    "force atomic day creation rollback",
  );
  const rolledBackDays = data(
    await operator
      .from("productions")
      .select("id")
      .eq("name", "Rollback Fictional Day"),
    "verify failed day rollback",
  );
  const rolledBackClients = data(
    await operator
      .from("clients")
      .select("id")
      .eq("name", "Rollback Fictional Client"),
    "verify failed client rollback",
  );
  assert.equal(rolledBackDays.length, 0);
  assert.equal(rolledBackClients.length, 0);

  const firstAdd = data(
    await operator.rpc("setup_add_person_to_roster", {
      p_production_id: productionId,
      p_person_id: person.id,
    }),
    "add existing person atomically",
  );
  assert.equal(firstAdd.roster.person_id, person.id);
  assert.equal(firstAdd.order.roster_id, firstAdd.roster.id);
  assert.equal(firstAdd.order.person_id, person.id);
  assert.equal(firstAdd.order.drink_type, "Iced latte");
  assert.equal(firstAdd.order.size, "Large");
  assert.equal(firstAdd.order.temperature, "Iced");
  assert.equal(firstAdd.order.milk_type, "Oat");
  assert.equal(firstAdd.order.sweetener, "Half sweet");

  const addCountBefore = await operator
    .from("production_roster")
    .select("id", { count: "exact", head: true })
    .eq("production_id", productionId);
  assert.ifError(addCountBefore.error);
  expectError(
    await operator.rpc("setup_add_person_to_roster", {
      p_production_id: productionId,
      p_person_id: person.id,
    }),
    "duplicate roster add",
  );
  const addCountAfter = await operator
    .from("production_roster")
    .select("id", { count: "exact", head: true })
    .eq("production_id", productionId);
  assert.ifError(addCountAfter.error);
  assert.equal(addCountAfter.count, addCountBefore.count);

  const triggerCandidate = data(
    await operator.rpc("setup_create_person", {
      p_name: "Direct Insert Candidate",
      p_active: true,
    }),
    "create trigger candidate",
  );
  createdPersonIds.push(triggerCandidate.id);
  expectError(
    await operator.from("production_roster").insert({
      production_id: productionId,
      person_id: triggerCandidate.id,
      group_label: "Set",
      on_set_today: true,
      sort_order: 2,
    }),
    "roster row without order",
  );
  const directRows = data(
    await operator
      .from("production_roster")
      .select("id")
      .eq("production_id", productionId)
      .eq("person_id", triggerCandidate.id),
    "verify rejected direct roster insert",
  );
  assert.equal(directRows.length, 0);

  const rosterBeforeRollback = await operator
    .from("production_roster")
    .select("id", { count: "exact", head: true })
    .eq("production_id", productionId);
  assert.ifError(rosterBeforeRollback.error);
  expectError(
    await operator.rpc("setup_bulk_add_roster", {
      p_production_id: productionId,
      p_people: [
        {
          name: "Rollback Candidate",
          group_label: "Set",
          on_set_today: true,
        },
        {
          name: person.name,
          person_id: person.id,
          group_label: "Camera",
          on_set_today: true,
        },
      ],
    }),
    "bulk rollback injection",
  );
  const rollbackPeople = data(
    await operator
      .from("people")
      .select("id")
      .eq("name", "Rollback Candidate"),
    "verify person rollback",
  );
  assert.equal(rollbackPeople.length, 0);
  const rosterAfterRollback = await operator
    .from("production_roster")
    .select("id", { count: "exact", head: true })
    .eq("production_id", productionId);
  assert.ifError(rosterAfterRollback.error);
  assert.equal(rosterAfterRollback.count, rosterBeforeRollback.count);

  const forty = Array.from({ length: 40 }, (_, index) => ({
    name: `Fictional Crew ${String(index + 1).padStart(2, "0")}`,
    group_label: index < 20 ? "Unit A" : "Unit B",
    on_set_today: true,
  }));
  const bulk = data(
    await operator.rpc("setup_bulk_add_roster", {
      p_production_id: productionId,
      p_people: forty,
    }),
    "commit 40-person roster",
  );
  assert.equal(bulk.length, 40);
  createdPersonIds.push(...bulk.map((item) => item.person.id));

  expectError(
    await operator.rpc("setup_bulk_add_roster", {
      p_production_id: productionId,
      p_people: [
        { name: "Payload Duplicate", group_label: "Set" },
        { name: "  payload   duplicate ", group_label: "Set" },
      ],
    }),
    "bulk payload duplicate",
  );

  const quick = data(
    await operator.rpc("setup_create_person_and_add_to_roster", {
      p_production_id: productionId,
      p_name: "Quick Fiction",
      p_type: "crew",
      p_department: "Production",
      p_group_label: "Production",
      p_on_set_today: true,
      p_link_to_client: false,
    }),
    "quick-create person and initial order",
  );
  createdPersonIds.push(quick.person.id);
  assert.equal(quick.order.roster_id, quick.roster.id);

  const roster = data(
    await operator
      .from("production_roster")
      .select("id,person_id,sort_order")
      .eq("production_id", productionId)
      .order("sort_order"),
    "load authoritative roster",
  );
  const orders = data(
    await operator
      .from("orders")
      .select("id,roster_id,person_id")
      .eq("production_id", productionId),
    "load authoritative orders",
  );
  assert.equal(roster.length, 42);
  assert.equal(orders.length, 42);
  const ordersByRoster = new Map();
  for (const order of orders) {
    const matching = ordersByRoster.get(order.roster_id) ?? [];
    matching.push(order);
    ordersByRoster.set(order.roster_id, matching);
  }
  for (const row of roster) {
    const matching = ordersByRoster.get(row.id) ?? [];
    assert.equal(matching.length, 1);
    assert.equal(matching[0].person_id, row.person_id);
  }

  const reversedIds = roster.map((row) => row.id).reverse();
  const reordered = data(
    await operator.rpc("setup_reorder_roster", {
      p_production_id: productionId,
      p_roster_ids: reversedIds,
    }),
    "reorder roster atomically",
  );
  assert.deepEqual(
    reordered.map((row) => row.id),
    reversedIds,
  );

  const grouped = data(
    await operator
      .from("production_roster")
      .update({ group_label: "Unit C", on_set_today: false })
      .eq("id", reversedIds[0])
      .eq("production_id", productionId)
      .select()
      .single(),
    "group and toggle roster member",
  );
  assert.equal(grouped.group_label, "Unit C");
  assert.equal(grouped.on_set_today, false);

  const removedRosterId = reversedIds.at(-1);
  data(
    await operator
      .from("production_roster")
      .delete()
      .eq("id", removedRosterId)
      .eq("production_id", productionId)
      .select("id")
      .single(),
    "remove roster member",
  );
  const removedOrder = data(
    await operator.from("orders").select("id").eq("roster_id", removedRosterId),
    "verify order cascade",
  );
  assert.equal(removedOrder.length, 0);

  const liveRoster = data(
    await operator
      .from("production_roster")
      .select("id")
      .eq("production_id", productionId)
      .eq("on_set_today", true)
      .limit(2),
    "load roster for progress",
  );
  const liveOrders = data(
    await operator
      .from("orders")
      .select("id")
      .eq("production_id", productionId)
      .in(
        "roster_id",
        liveRoster.map((row) => row.id),
      ),
    "load orders for progress",
  );
  data(
    await operator
      .from("orders")
      .update({ status: "confirmed", label_printed: true })
      .eq("id", liveOrders[0].id)
      .select("id")
      .single(),
    "capture and print one fictional order",
  );
  data(
    await operator
      .from("orders")
      .update({ status: "no_order" })
      .eq("id", liveOrders[1].id)
      .select("id")
      .single(),
    "skip one fictional order",
  );
  data(
    await operator.rpc("setup_update_day", {
      p_production_id: productionId,
      p_name: "Build 12 Fictional Shoot",
      p_client_id: clientId,
      p_shoot_date: "2026-08-04",
      p_location: "Stage 12",
      p_runner_name: "Taylor Fiction",
      p_notes: "Updated local verification only.",
      p_status: "active",
    }),
    "activate day",
  );
  expectError(
    await operator.rpc("setup_delete_planning_day", {
      p_production_id: productionId,
    }),
    "refuse active day deletion",
  );
  const activeDayRows = data(
    await operator
      .from("productions")
      .select("id")
      .eq("id", productionId),
    "verify active day remains after rejected deletion",
  );
  assert.equal(activeDayRows.length, 1);
  const completeDay = data(
    await operator.rpc("setup_create_day", {
      p_name: "Completed Fictional Day",
      p_client_id: clientId,
      p_status: "complete",
      p_seed_default_roster: false,
    }),
    "create complete empty day",
  );
  createdProductionIds.push(completeDay.production.id);

  const summaries = data(
    await operator.rpc("fetch_day_summaries"),
    "fetch bounded day summaries",
  );
  const mainSummary = summaries.find((summary) => summary.id === productionId);
  const completeSummary = summaries.find(
    (summary) => summary.id === completeDay.production.id,
  );
  assert.ok(mainSummary);
  assert.equal(mainSummary.status, "active");
  assert.equal(mainSummary.total, 40);
  assert.equal(mainSummary.captured, 1);
  assert.equal(mainSummary.skipped, 1);
  assert.equal(mainSummary.printed, 1);
  assert.equal(completeSummary.total, 0);

  const archived = data(
    await operator.rpc("setup_update_person", {
      p_person_id: triggerCandidate.id,
      p_name: triggerCandidate.name,
      p_type: triggerCandidate.type,
      p_active: false,
    }),
    "archive person",
  );
  assert.equal(archived.active, false);

  console.log(
    "Build 12 local verification passed: auth boundary, private photo, safe day deletion, atomic create/add/bulk, rollback, relationship integrity, reorder/group/remove, and bounded summaries.",
  );
} finally {
  if (photoPath) {
    await admin.storage.from("person-photos").remove([photoPath]);
  }
  if (createdProductionIds.length) {
    await admin.from("productions").delete().in("id", createdProductionIds);
  }
  if (createdPersonIds.length) {
    await admin.from("people").delete().in("id", createdPersonIds);
  }
  if (createdClientIds.length) {
    await admin.from("clients").delete().in("id", createdClientIds);
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
