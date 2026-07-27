import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const authorizedProjectRef = "svqxznvyrbmbqihekkwo";
const productionProjectRef = "lehwhehssjfudyrtljus";

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

const apiUrl = new URL(requireEnvironment("BUILD10_SUPABASE_URL"));
const publishableKey = requireEnvironment("BUILD10_SUPABASE_PUBLISHABLE_KEY");
const userAEmail = requireEnvironment("BUILD10_USER_A_EMAIL");
const userAPassword = requireEnvironment("BUILD10_USER_A_PASSWORD");
const userBEmail = requireEnvironment("BUILD10_USER_B_EMAIL");
const userBPassword = requireEnvironment("BUILD10_USER_B_PASSWORD");

assert.notEqual(
  authorizedProjectRef,
  productionProjectRef,
  "Disposable and production refs must differ.",
);
assert.equal(
  apiUrl.protocol,
  "https:",
  "Remote acceptance requires an HTTPS Supabase URL.",
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
  "Remote acceptance must use only a public anon/publishable key.",
);

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const anonymous = createClient(
  apiUrl.origin,
  publishableKey,
  clientOptions,
);
const userA = createClient(apiUrl.origin, publishableKey, clientOptions);
const userB = createClient(apiUrl.origin, publishableKey, clientOptions);

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let channel;
let productionId;
let clientId;
let personId;
let runFailed = false;
const cleanupErrors = [];

function requireData(result, label) {
  assert.ifError(result.error);
  assert.ok(result.data, `${label} returned no data`);
  return result.data;
}

function recordCleanupError(result, label) {
  if (result.error) cleanupErrors.push(`${label}: ${result.error.code}`);
}

try {
  const anonymousRead = await anonymous.from("orders").select("id").limit(1);
  assert.ok(anonymousRead.error, "Anonymous order reads must be refused");

  requireData(
    await userA.auth.signInWithPassword({
      email: userAEmail,
      password: userAPassword,
    }),
    "sign in disposable user A",
  );
  requireData(
    await userB.auth.signInWithPassword({
      email: userBEmail,
      password: userBPassword,
    }),
    "sign in disposable user B",
  );

  const client = requireData(
    await userA
      .from("clients")
      .insert({ name: `Build 10 remote client ${suffix}` })
      .select("id")
      .single(),
    "create fictional client",
  );
  clientId = client.id;

  const person = requireData(
    await userA
      .from("people")
      .insert({
        name: `Build 10 Remote Person ${suffix}`,
        usual_order: "Large, Fictional latte",
      })
      .select("id")
      .single(),
    "create fictional person",
  );
  personId = person.id;

  const production = requireData(
    await userA
      .from("productions")
      .insert({
        name: `Build 10 remote day ${suffix}`,
        client_id: clientId,
        status: "active",
      })
      .select("id")
      .single(),
    "create fictional production",
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
    "create fictional roster row",
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
    "create fictional order",
  );

  const userBRead = requireData(
    await userB.from("orders").select("id").eq("id", order.id).single(),
    "authenticated RLS read",
  );
  assert.equal(userBRead.id, order.id);

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
      .update({ usual_order: "Large, Fictional oat latte" })
      .eq("id", personId)
      .eq("usual_order", usualObserved)
      .select("usual_order")
      .maybeSingle(),
    "conditional usual-order save",
  );
  assert.equal(usualSaved.usual_order, "Large, Fictional oat latte");

  requireData(
    await userB
      .from("people")
      .update({ usual_order: "Fictional double espresso" })
      .eq("id", personId)
      .select("usual_order")
      .single(),
    "competing usual-order edit",
  );
  const staleUsual = await userA
    .from("people")
    .update({ usual_order: "Stale fictional flat white" })
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
      .select("label_printed,updated_at")
      .single(),
    "mark fictional print",
  );
  assert.equal(printed.label_printed, true);

  const falseWrite = requireData(
    await userB
      .from("orders")
      .update({ label_printed: false })
      .eq("id", order.id)
      .select("label_printed,updated_at")
      .single(),
    "attempt to weaken fictional print fact",
  );
  assert.equal(
    falseWrite.label_printed,
    true,
    "label_printed true must be irreversible",
  );

  await new Promise((resolve) => setTimeout(resolve, 10));
  const identicalWrite = requireData(
    await userA
      .from("orders")
      .update({ drink_type: "Web americano" })
      .eq("id", order.id)
      .select("drink_type,updated_at")
      .single(),
    "identical ordinary-field write",
  );
  assert.equal(identicalWrite.drink_type, "Web americano");
  assert.notEqual(
    identicalWrite.updated_at,
    falseWrite.updated_at,
    "Every order UPDATE must advance updated_at",
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
      .channel(`build10-remote-verification-${suffix}`)
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
        targetRef: authorizedProjectRef,
        credentialClass: "public anon/publishable key plus user sessions",
        anonymousRls: "refused",
        authenticatedRls: "read/write",
        orderCas: "saved then stale write refused",
        usualOrderCas: "saved then stale write refused",
        labelPrinted: "true remained true after false write",
        updatedAt: "advanced after an identical-value UPDATE",
        realtime: "filtered UPDATE observed",
      },
      null,
      2,
    ),
  );
} catch (error) {
  runFailed = true;
  throw error;
} finally {
  if (channel) await userA.removeChannel(channel);
  userA.realtime.disconnect();
  userB.realtime.disconnect();

  if (productionId) {
    recordCleanupError(
      await userA.from("productions").delete().eq("id", productionId),
      "delete fictional production",
    );
  }
  if (personId) {
    recordCleanupError(
      await userA.from("people").delete().eq("id", personId),
      "delete fictional person",
    );
  }
  if (clientId) {
    recordCleanupError(
      await userA.from("clients").delete().eq("id", clientId),
      "delete fictional client",
    );
  }
  await userA.auth.signOut();
  await userB.auth.signOut();

  if (cleanupErrors.length > 0) {
    const cleanupMessage =
      "Remote verifier cleanup failed: " + cleanupErrors.join(", ");
    if (!runFailed) throw new Error(cleanupMessage);
    console.error(cleanupMessage);
  }
}
