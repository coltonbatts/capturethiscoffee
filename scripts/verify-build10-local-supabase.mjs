import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const workdir = process.argv[2];
if (!workdir) {
  throw new Error(
    "Usage: node scripts/verify-build10-local-supabase.mjs <local-supabase-workdir>",
  );
}

const status = JSON.parse(
  execFileSync(
    "npx",
    [
      "--yes",
      "supabase@2.109.1",
      "status",
      "--workdir",
      workdir,
      "--output",
      "json",
    ],
    { encoding: "utf8" },
  ),
);
const apiUrl = new URL(status.API_URL);
assert.ok(
  apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost",
  `Refusing to mutate a non-local Supabase URL: ${apiUrl.origin}`,
);

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const admin = createClient(
  apiUrl.origin,
  status.SERVICE_ROLE_KEY,
  clientOptions,
);
const anonymous = createClient(
  apiUrl.origin,
  status.ANON_KEY,
  clientOptions,
);
const userA = createClient(apiUrl.origin, status.ANON_KEY, clientOptions);
const userB = createClient(apiUrl.origin, status.ANON_KEY, clientOptions);

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Build10-${suffix}-Pass!`;
const emails = {
  a: `build10-a-${suffix}@example.test`,
  b: `build10-b-${suffix}@example.test`,
};
const createdUserIds = [];
let channel;
let productionId;
let clientId;
let personId;

function requireData(result, label) {
  assert.ifError(result.error);
  assert.ok(result.data, `${label} returned no data`);
  return result.data;
}

try {
  const anonymousRead = await anonymous.from("orders").select("id").limit(1);
  assert.ok(anonymousRead.error, "Anonymous order reads must be refused");

  for (const email of [emails.a, emails.b]) {
    const created = requireData(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
      `create ${email}`,
    );
    createdUserIds.push(created.user.id);
  }

  requireData(
    await userA.auth.signInWithPassword({ email: emails.a, password }),
    "sign in user A",
  );
  requireData(
    await userB.auth.signInWithPassword({ email: emails.b, password }),
    "sign in user B",
  );

  const client = requireData(
    await userA
      .from("clients")
      .insert({ name: `Build 10 client ${suffix}` })
      .select("id")
      .single(),
    "create client",
  );
  clientId = client.id;
  const person = requireData(
    await userA
      .from("people")
      .insert({
        name: `Build 10 person ${suffix}`,
        usual_order: "Large, Latte",
      })
      .select("id")
      .single(),
    "create person",
  );
  personId = person.id;
  const production = requireData(
    await userA
      .from("productions")
      .insert({
        name: `Build 10 day ${suffix}`,
        client_id: clientId,
        status: "active",
      })
      .select("id")
      .single(),
    "create production",
  );
  productionId = production.id;
  const roster = requireData(
    await userA
      .from("production_roster")
      .insert({
        production_id: productionId,
        person_id: personId,
        on_set_today: true,
      })
      .select("id")
      .single(),
    "create roster",
  );
  const order = requireData(
    await userA
      .from("orders")
      .insert({
        production_id: productionId,
        roster_id: roster.id,
        person_id: personId,
        status: "not_asked",
        label_printed: false,
      })
      .select("id,updated_at")
      .single(),
    "create order",
  );

  const userARead = requireData(
    await userA.from("orders").select("id").eq("id", order.id).single(),
    "authenticated RLS read",
  );
  assert.equal(userARead.id, order.id);

  const casSaved = requireData(
    await userA
      .from("orders")
      .update({ drink_type: "Phone latte", status: "confirmed" })
      .eq("id", order.id)
      .eq("production_id", productionId)
      .eq("updated_at", order.updated_at)
      .select("id,drink_type,status,updated_at")
      .maybeSingle(),
    "conditional order save",
  );
  assert.equal(casSaved.drink_type, "Phone latte");
  assert.notEqual(casSaved.updated_at, order.updated_at);

  const competing = requireData(
    await userB
      .from("orders")
      .update({ drink_type: "Web americano" })
      .eq("id", order.id)
      .select("drink_type,updated_at")
      .single(),
    "competing authenticated edit",
  );
  assert.equal(competing.drink_type, "Web americano");

  const staleCas = await userA
    .from("orders")
    .update({ drink_type: "Stale phone mocha" })
    .eq("id", order.id)
    .eq("production_id", productionId)
    .eq("updated_at", casSaved.updated_at)
    .select("id")
    .maybeSingle();
  assert.ifError(staleCas.error);
  assert.equal(staleCas.data, null, "A stale CAS must update zero rows");
  const afterConflict = requireData(
    await userA
      .from("orders")
      .select("drink_type")
      .eq("id", order.id)
      .single(),
    "read competing value",
  );
  assert.equal(afterConflict.drink_type, "Web americano");

  const usualObserved = requireData(
    await userA
      .from("people")
      .select("usual_order")
      .eq("id", personId)
      .single(),
    "read usual order",
  ).usual_order;
  const usualSaved = requireData(
    await userA
      .from("people")
      .update({ usual_order: "Large, Oat latte" })
      .eq("id", personId)
      .eq("usual_order", usualObserved)
      .select("usual_order")
      .maybeSingle(),
    "conditional usual-order save",
  );
  assert.equal(usualSaved.usual_order, "Large, Oat latte");
  requireData(
    await userB
      .from("people")
      .update({ usual_order: "Double espresso" })
      .eq("id", personId)
      .select("usual_order")
      .single(),
    "competing usual-order edit",
  );
  const staleUsual = await userA
    .from("people")
    .update({ usual_order: "Stale flat white" })
    .eq("id", personId)
    .eq("usual_order", usualSaved.usual_order)
    .select("usual_order")
    .maybeSingle();
  assert.ifError(staleUsual.error);
  assert.equal(
    staleUsual.data,
    null,
    "A stale usual-order condition must update zero rows",
  );

  const printed = requireData(
    await userA
      .from("orders")
      .update({ label_printed: true })
      .eq("id", order.id)
      .select("label_printed")
      .single(),
    "mark physical print",
  );
  assert.equal(printed.label_printed, true);
  const stalePrintedWrite = requireData(
    await userB
      .from("orders")
      .update({
        drink_type: "Competing full-row drink",
        label_printed: false,
      })
      .eq("id", order.id)
      .select("label_printed")
      .single(),
    "attempt to weaken physical fact",
  );
  assert.equal(
    stalePrintedWrite.label_printed,
    true,
    "label_printed true must be irreversible",
  );

  let resolveRealtimePayload;
  const realtimePayloadReceived = new Promise((resolve) => {
    resolveRealtimePayload = resolve;
  });
  const realtimeSubscribed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Realtime channel did not subscribe"));
    }, 20_000);
    channel = userA
      .channel(`build10-verification-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `production_id=eq.${productionId}`,
        },
        (payload) => {
          if (!payload.new?.special_notes?.startsWith(`Realtime ${suffix}`)) {
            return;
          }
          resolveRealtimePayload(payload);
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel entered ${state}`));
        }
      });
  });
  await realtimeSubscribed;
  let realtimePayload;
  for (let attempt = 1; attempt <= 5 && !realtimePayload; attempt += 1) {
    requireData(
      await userB
        .from("orders")
        .update({ special_notes: `Realtime ${suffix} attempt ${attempt}` })
        .eq("id", order.id)
        .select("id")
        .single(),
      "emit Realtime update",
    );
    realtimePayload = await Promise.race([
      realtimePayloadReceived,
      new Promise((resolve) => setTimeout(() => resolve(null), 1_500)),
    ]);
  }
  assert.ok(realtimePayload, "Filtered Realtime updates must be observed");
  assert.equal(realtimePayload.new.id, order.id);

  console.log(
    JSON.stringify(
      {
        target: apiUrl.origin,
        anonymousRls: "refused",
        authenticatedRls: "read/write",
        orderCas: "saved then stale write refused",
        usualOrderCas: "saved then stale write refused",
        labelPrinted: "true remained true after false write",
        realtime: "filtered UPDATE observed",
      },
      null,
      2,
    ),
  );
} finally {
  if (channel) await userA.removeChannel(channel);
  userA.realtime.disconnect();
  if (productionId) {
    await userA.from("productions").delete().eq("id", productionId);
  }
  if (personId) await userA.from("people").delete().eq("id", personId);
  if (clientId) await userA.from("clients").delete().eq("id", clientId);
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}
