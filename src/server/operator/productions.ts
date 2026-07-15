import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NewProductionInput,
  UpdateProductionInput,
} from "@/lib/operator-inputs";
import type { Database } from "@/lib/supabase";
import type { Client, Person, Production } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  requireOperatorRow,
  throwOperatorDatabaseError,
} from "./errors";
import { mapClient, mapPerson, mapProduction, mapRoster } from "./mappers";
import { toInitialOrderInsert } from "./order-drafts";
import {
  normalizeNewProductionInput,
  normalizeProductionPatch,
  nullableText,
  requireId,
} from "./validation";

export async function createProduction(
  input: NewProductionInput,
): Promise<Production> {
  const { supabase } = await requireOperatorContext();
  const normalized = normalizeNewProductionInput(input);
  if (!normalized.client_id && !normalized.new_client_name) {
    throw new OperatorDataError(
      "Choose a client or enter a new client name.",
      "validation",
    );
  }

  const { client, clientId } = await resolveClient(
    supabase,
    normalized.client_id,
    normalized.new_client_name,
  );
  const productionResult = await supabase
    .from("productions")
    .insert({
      name: normalized.name,
      client_id: clientId,
      shoot_date: nullableText(normalized.shoot_date, 20),
      location: nullableText(normalized.location, 500),
      runner_name: nullableText(normalized.runner_name, 200),
      notes: nullableText(normalized.notes, 2000),
      status: "active",
    })
    .select("*")
    .single();
  throwOperatorDatabaseError(
    productionResult.error,
    "Could not create production.",
  );
  const production = mapProduction(
    requireOperatorRow(productionResult.data, "Could not create production."),
  );

  const rosterPeople = await defaultRosterPeople(supabase, clientId);
  if (rosterPeople.length) {
    const rosterResult = await supabase
      .from("production_roster")
      .insert(
        rosterPeople.map((person, index) => ({
          production_id: production.id,
          person_id: person.id,
          group_label:
            person.department ||
            (person.type === "client_contact" ? client.name : person.company) ||
            "Set",
          on_set_today: true,
          sort_order: index + 1,
        })),
      )
      .select("*");
    throwOperatorDatabaseError(rosterResult.error, "Could not create roster.");

    const roster = (rosterResult.data || []).map(mapRoster);
    const orders = roster.flatMap((item) => {
      const person = rosterPeople.find((candidate) => candidate.id === item.person_id);
      return person ? [toInitialOrderInsert(production, item, person)] : [];
    });
    if (orders.length) {
      const orderResult = await supabase.from("orders").insert(orders);
      throwOperatorDatabaseError(orderResult.error, "Could not create order drafts.");
    }
  }

  return production;
}

export async function updateProduction(
  productionId: string,
  input: UpdateProductionInput,
): Promise<Production> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(productionId, "Production ID");
  const currentResult = await supabase
    .from("productions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOperatorDatabaseError(currentResult.error, "Could not load production.");
  if (!currentResult.data) {
    throw new OperatorDataError("Production not found.", "not_found");
  }
  const current = mapProduction(currentResult.data);
  const patch = normalizeProductionPatch(input);
  let clientId = patch.client_id || current.client_id;
  if (patch.new_client_name) {
    clientId = (
      await resolveClient(supabase, clientId, patch.new_client_name)
    ).clientId;
  } else if (patch.client_id) {
    clientId = requireId(patch.client_id, "Client ID");
  }

  const result = await supabase
    .from("productions")
    .update({
      name: patch.name ?? current.name,
      client_id: clientId,
      shoot_date: nullableText(patch.shoot_date ?? current.shoot_date, 20),
      location: nullableText(patch.location ?? current.location, 500),
      runner_name: nullableText(patch.runner_name ?? current.runner_name, 200),
      notes: nullableText(patch.notes ?? current.notes, 2000),
      status: patch.status ?? current.status,
    })
    .eq("id", id)
    .select("*")
    .single();
  throwOperatorDatabaseError(result.error, "Could not update production.");
  return mapProduction(
    requireOperatorRow(result.data, "Could not update production."),
  );
}

export async function deleteProduction(
  productionId: string,
): Promise<{ id: string }> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(productionId, "Production ID");
  const { error } = await supabase.from("productions").delete().eq("id", id);
  throwOperatorDatabaseError(error, "Could not delete production.");
  return { id };
}

export async function mintProductionShareToken(
  productionId: string,
  label = "runner-link",
): Promise<{ productionId: string; token: string }> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(productionId, "Production ID");
  const result = await supabase.rpc("create_production_share_token", {
    p_production_id: id,
    p_label: nullableText(label, 200),
  });
  throwOperatorDatabaseError(result.error, "Could not create share link.");
  if (!result.data) {
    throw new OperatorDataError(
      "Could not create share link.",
      "database",
    );
  }
  return { productionId: id, token: result.data };
}

async function resolveClient(
  supabase: SupabaseClient<Database>,
  rawClientId: string | undefined,
  rawName: string | undefined,
): Promise<{ client: Client; clientId: string }> {
  const name = rawName?.trim() || "";
  if (name) {
    const existingResult = await supabase
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    throwOperatorDatabaseError(existingResult.error, "Could not load clients.");
    const existing = (existingResult.data || []).find(
      (row) => row.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      const client = mapClient(existing);
      return { client, clientId: client.id };
    }
    const insertResult = await supabase
      .from("clients")
      .insert({ name, active: true })
      .select("*")
      .single();
    throwOperatorDatabaseError(insertResult.error, "Could not create client.");
    const client = mapClient(
      requireOperatorRow(insertResult.data, "Could not create client."),
    );
    return { client, clientId: client.id };
  }

  const clientId = requireId(rawClientId, "Client ID");
  const result = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  throwOperatorDatabaseError(result.error, "Could not load client.");
  if (!result.data) throw new OperatorDataError("Client not found.", "not_found");
  return { client: mapClient(result.data), clientId };
}

async function defaultRosterPeople(
  supabase: SupabaseClient<Database>,
  clientId: string,
): Promise<Person[]> {
  const [linksResult, crewResult] = await Promise.all([
    supabase
      .from("client_people")
      .select("person_id")
      .eq("client_id", clientId)
      .eq("active", true),
    supabase
      .from("people")
      .select("*")
      .eq("type", "crew")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(4),
  ]);
  throwOperatorDatabaseError(linksResult.error, "Could not load client people.");
  throwOperatorDatabaseError(crewResult.error, "Could not load crew.");
  const personIds = (linksResult.data || []).map((item) => item.person_id);
  const linkedResult = personIds.length
    ? await supabase.from("people").select("*").in("id", personIds)
    : { data: [], error: null };
  throwOperatorDatabaseError(linkedResult.error, "Could not load client people.");

  const combined = [...(linkedResult.data || []), ...(crewResult.data || [])].map(
    mapPerson,
  );
  return combined.filter(
    (person, index) => combined.findIndex((item) => item.id === person.id) === index,
  );
}
