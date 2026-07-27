import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const authorizedProjectRef = "svqxznvyrbmbqihekkwo";
const productionProjectRef = "lehwhehssjfudyrtljus";
const expectedProductionRoles = [
  "batch",
  "recovery",
  "acceptance",
  "planning",
  "complete",
];

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function rejectsPrivilegedKey(key) {
  if (
    key.startsWith("sb_secret_") ||
    key.toLowerCase().includes("service_role")
  ) {
    return true;
  }
  if (!key.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function requireData(result, label) {
  assert.ifError(result.error);
  assert.ok(result.data, `${label} returned no data`);
  return result.data;
}

function fixtureNames(tag) {
  return {
    client: `Build 10 Disposable Client · ${tag}`,
    marker: `Build 10 physical fixture · ${tag}`,
    productions: {
      batch: `Build 9 · Ten Label Batch · ${tag}`,
      recovery: `Build 9 · Recovery Active · ${tag}`,
      acceptance: `Build 10 · Acceptance Active · ${tag}`,
      planning: `Build 10 · Planning Refusal · ${tag}`,
      complete: `Build 10 · Complete Refusal · ${tag}`,
    },
  };
}

function withoutFixtureRole(row) {
  const databaseRow = { ...row };
  delete databaseRow.role;
  return databaseRow;
}

const action = process.argv[2];
const tag = process.argv[3];
if (!["seed", "inspect", "cleanup"].includes(action) || !tag) {
  throw new Error(
    "Usage: node scripts/manage-build10-physical-fixture.mjs " +
      "<seed|inspect|cleanup> <fixture-tag>",
  );
}
assert.match(
  tag,
  /^build10-[a-z0-9-]{6,48}$/,
  "Fixture tag must start with build10- and contain only lowercase letters, numbers, and hyphens.",
);

const apiUrl = new URL(requireEnvironment("BUILD10_SUPABASE_URL"));
const publishableKey = requireEnvironment("BUILD10_SUPABASE_PUBLISHABLE_KEY");
const userEmail = requireEnvironment("BUILD10_USER_A_EMAIL");
const userPassword = requireEnvironment("BUILD10_USER_A_PASSWORD");

assert.notEqual(
  authorizedProjectRef,
  productionProjectRef,
  "Disposable and production refs must differ.",
);
assert.equal(
  apiUrl.protocol,
  "https:",
  "Remote fixture management requires an HTTPS Supabase URL.",
);
assert.equal(
  apiUrl.hostname,
  `${authorizedProjectRef}.supabase.co`,
  "Refusing to access a Supabase host outside the authorized disposable project.",
);
assert.ok(
  !apiUrl.hostname.includes(productionProjectRef),
  "Refusing to access the production project.",
);
assert.ok(
  !rejectsPrivilegedKey(publishableKey),
  "Physical fixture management must use only a public anon/publishable key.",
);

const supabase = createClient(apiUrl.origin, publishableKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
const names = fixtureNames(tag);

async function signIn() {
  requireData(
    await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    }),
    "sign in disposable fixture owner",
  );
}

async function findFixtureClient() {
  return requireData(
    await supabase
      .from("clients")
      .select("id,name")
      .eq("name", names.client),
    "find exact fixture client",
  );
}

async function inspectFixture() {
  const clients = await findFixtureClient();
  assert.equal(clients.length, 1, "Expected exactly one fixture client");
  const client = clients[0];
  const productions = requireData(
    await supabase
      .from("productions")
      .select("id,name,status")
      .eq("client_id", client.id)
      .order("name"),
    "read fixture productions",
  );
  assert.equal(
    productions.length,
    expectedProductionRoles.length,
    "Fixture must contain exactly five productions",
  );

  const productionIds = productions.map((production) => production.id);
  const roster = requireData(
    await supabase
      .from("production_roster")
      .select("id,production_id,person_id")
      .in("production_id", productionIds),
    "read fixture roster",
  );
  const orders = requireData(
    await supabase
      .from("orders")
      .select(
        "id,production_id,person_id,status,label_printed,updated_at,drink_type",
      )
      .in("production_id", productionIds),
    "read fixture orders",
  );

  return {
    targetRef: authorizedProjectRef,
    fixtureTag: tag,
    client,
    productions: productions.map((production) => ({
      ...production,
      rosterCount: roster.filter(
        (entry) => entry.production_id === production.id,
      ).length,
      orderCount: orders.filter(
        (order) => order.production_id === production.id,
      ).length,
      capturedUnprintedCount: orders.filter(
        (order) =>
          order.production_id === production.id &&
          order.status === "confirmed" &&
          order.label_printed === false,
      ).length,
      notAskedCount: orders.filter(
        (order) =>
          order.production_id === production.id &&
          order.status === "not_asked",
      ).length,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      productionId: order.production_id,
      personId: order.person_id,
      status: order.status,
      labelPrinted: order.label_printed,
      updatedAt: order.updated_at,
      drinkType: order.drink_type,
    })),
  };
}

async function deleteFixture({ requireCompleteFixture }) {
  const clients = await findFixtureClient();
  if (clients.length === 0) {
    return {
      targetRef: authorizedProjectRef,
      fixtureTag: tag,
      cleanup: "already absent",
    };
  }
  assert.equal(clients.length, 1, "Refusing ambiguous fixture cleanup");
  const client = clients[0];
  const productions = requireData(
    await supabase
      .from("productions")
      .select("id,name")
      .eq("client_id", client.id),
    "find fixture productions for cleanup",
  );
  if (requireCompleteFixture) {
    assert.equal(
      productions.length,
      expectedProductionRoles.length,
      "Refusing cleanup because the fixture is not the expected five-day set",
    );
    const observedNames = new Set(
      productions.map((production) => production.name),
    );
    for (const productionName of Object.values(names.productions)) {
      assert.ok(
        observedNames.has(productionName),
        `Refusing cleanup because ${productionName} is missing`,
      );
    }
  }

  if (productions.length > 0) {
    const deletedProductions = requireData(
      await supabase
        .from("productions")
        .delete()
        .in(
          "id",
          productions.map((production) => production.id),
        )
        .select("id"),
      "delete exact fixture productions",
    );
    assert.equal(deletedProductions.length, productions.length);
  }

  const people = requireData(
    await supabase
      .from("people")
      .select("id")
      .eq("notes", names.marker),
    "find exact fixture people",
  );
  if (people.length > 0) {
    const deletedPeople = requireData(
      await supabase
        .from("people")
        .delete()
        .in(
          "id",
          people.map((person) => person.id),
        )
        .select("id"),
      "delete exact fixture people",
    );
    assert.equal(deletedPeople.length, people.length);
  }

  const deletedClient = requireData(
    await supabase
      .from("clients")
      .delete()
      .eq("id", client.id)
      .eq("name", names.client)
      .select("id"),
    "delete exact fixture client",
  );
  assert.equal(deletedClient.length, 1);

  return {
    targetRef: authorizedProjectRef,
    fixtureTag: tag,
    cleanup: "five productions and tagged fictional rows removed",
  };
}

async function seedFixture() {
  const existing = await findFixtureClient();
  assert.equal(existing.length, 0, "Fixture tag already exists");

  let clientId;
  let seedComplete = false;
  try {
    const client = requireData(
      await supabase
        .from("clients")
        .insert({
          name: names.client,
          notes: names.marker,
        })
        .select("id")
        .single(),
      "create fictional fixture client",
    );
    clientId = client.id;

    const productionRows = Object.entries(names.productions).map(
      ([role, name]) => ({
        role,
        name,
        client_id: clientId,
        shoot_date: "2026-07-27",
        location: "Fictional Test Studio",
        runner_name: "Disposable Test Operator",
        notes: names.marker,
        status:
          role === "planning"
            ? "planning"
            : role === "complete"
              ? "complete"
              : "active",
      }),
    );
    const productions = requireData(
      await supabase
        .from("productions")
        .insert(productionRows.map(withoutFixtureRole))
        .select("id,name,status"),
      "create five fictional fixture productions",
    );
    assert.equal(productions.length, expectedProductionRoles.length);
    const productionByRole = Object.fromEntries(
      productionRows.map((row) => [
        row.role,
        productions.find((production) => production.name === row.name),
      ]),
    );
    for (const role of expectedProductionRoles) {
      assert.ok(productionByRole[role], `Missing ${role} production`);
    }

    const peopleRows = Array.from({ length: 24 }, (_, index) => ({
      name: `Fictional Operator ${String(index + 1).padStart(2, "0")} · ${tag}`,
      type: index === 0 ? "client_contact" : "crew",
      role: `Test role ${String(index + 1).padStart(2, "0")}`,
      department: "Fictional Validation",
      company: "Capture This Disposable Test",
      usual_order:
        index % 2 === 0
          ? "Large, Hot, Fictional oat latte"
          : "Medium, Iced, Fictional decaf americano",
      notes: names.marker,
    }));
    const people = requireData(
      await supabase
        .from("people")
        .insert(peopleRows)
        .select("id,name"),
      "create 24 fictional fixture people",
    );
    assert.equal(people.length, peopleRows.length);
    const peopleByName = new Map(people.map((person) => [person.name, person]));

    const assignments = {
      batch: peopleRows.slice(0, 10),
      recovery: peopleRows.slice(10, 22),
      acceptance: peopleRows,
      planning: peopleRows.slice(22, 23),
      complete: peopleRows.slice(23, 24),
    };
    const rosterRows = Object.entries(assignments).flatMap(
      ([role, assignedPeople]) =>
        assignedPeople.map((person, index) => ({
          role,
          production_id: productionByRole[role].id,
          person_id: peopleByName.get(person.name).id,
          group_label:
            role === "batch"
              ? "Ten-label batch"
              : role === "recovery"
                ? "Recovery reserve"
                : role === "acceptance"
                  ? "Build 10 acceptance"
                  : "Inactive-day refusal",
          on_set_today: true,
          sort_order: index,
        })),
    );
    const roster = requireData(
      await supabase
        .from("production_roster")
        .insert(rosterRows.map(withoutFixtureRole))
        .select("id,production_id,person_id"),
      "create fictional fixture rosters",
    );
    assert.equal(roster.length, rosterRows.length);
    const rosterByProductionAndPerson = new Map(
      roster.map((entry) => [
        `${entry.production_id}:${entry.person_id}`,
        entry,
      ]),
    );

    const orderRows = rosterRows.map((rosterRow, index) => {
      const role = rosterRow.role;
      const captured = role !== "acceptance";
      const ordinal = String(index + 1).padStart(2, "0");
      return {
        production_id: rosterRow.production_id,
        roster_id: rosterByProductionAndPerson.get(
          `${rosterRow.production_id}:${rosterRow.person_id}`,
        ).id,
        person_id: rosterRow.person_id,
        drink_type: captured ? `Fictional validation latte ${ordinal}` : null,
        size: captured ? (index % 2 === 0 ? "Large" : "Medium") : null,
        temperature: captured ? (index % 3 === 0 ? "Iced" : "Hot") : null,
        milk_type: captured ? "Oat" : null,
        caffeine: captured ? "Regular" : null,
        special_notes: captured ? `Disposable test order ${ordinal}` : null,
        status: captured ? "confirmed" : "not_asked",
        label_printed: false,
      };
    });
    const orders = requireData(
      await supabase
        .from("orders")
        .insert(orderRows)
        .select("id,production_id,status,label_printed"),
      "create fictional fixture orders",
    );
    assert.equal(orders.length, orderRows.length);

    seedComplete = true;
    return await inspectFixture();
  } finally {
    if (!seedComplete && clientId) {
      await deleteFixture({ requireCompleteFixture: false });
    }
  }
}

try {
  await signIn();
  let result;
  if (action === "seed") {
    result = await seedFixture();
  } else if (action === "inspect") {
    result = await inspectFixture();
  } else {
    result = await deleteFixture({ requireCompleteFixture: true });
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await supabase.auth.signOut();
}
