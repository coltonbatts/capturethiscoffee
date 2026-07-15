import "server-only";

import type {
  CreatePersonAndRosterOptions,
  NewPersonInput,
  UpdateRosterInput,
} from "@/lib/operator-inputs";
import type { Order, Person, ProductionRoster } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  requireOperatorRow,
  throwOperatorDatabaseError,
} from "./errors";
import { mapOrder, mapProduction, mapRoster } from "./mappers";
import { toInitialOrderInsert } from "./order-drafts";
import { insertPerson } from "./people";
import {
  normalizePersonInput,
  normalizeRosterPatch,
  nullableText,
  requireId,
} from "./validation";

export async function addRosterPerson(
  productionId: string,
  personId: string,
): Promise<{ roster: ProductionRoster; order: Order }> {
  const { supabase } = await requireOperatorContext();
  const production_id = requireId(productionId, "Production ID");
  const person_id = requireId(personId, "Person ID");
  const [productionResult, personResult, rosterResult] = await Promise.all([
    supabase.from("productions").select("*").eq("id", production_id).maybeSingle(),
    supabase.from("people").select("*").eq("id", person_id).maybeSingle(),
    supabase
      .from("production_roster")
      .select("id", { count: "exact", head: true })
      .eq("production_id", production_id),
  ]);
  throwOperatorDatabaseError(productionResult.error, "Could not load production.");
  throwOperatorDatabaseError(personResult.error, "Could not load person.");
  throwOperatorDatabaseError(rosterResult.error, "Could not load roster.");
  if (!productionResult.data || !personResult.data) {
    throw new OperatorDataError("Production or person not found.", "not_found");
  }
  const production = mapProduction(productionResult.data);
  const person = {
    ...personResult.data,
    role: personResult.data.role || "",
    department: personResult.data.department || "",
    company: personResult.data.company || "",
    photo_url: personResult.data.photo_url || "",
    usual_order: personResult.data.usual_order || "",
    dietary_notes: personResult.data.dietary_notes || "",
    notes: personResult.data.notes || "",
  } satisfies Person;
  return insertRosterAndOrder(supabase, production, person, (rosterResult.count || 0) + 1);
}

export async function createPersonAndAddToRoster(
  productionId: string,
  input: NewPersonInput,
  options: CreatePersonAndRosterOptions = {},
): Promise<{ person: Person; roster: ProductionRoster; order: Order }> {
  const { supabase } = await requireOperatorContext();
  const production_id = requireId(productionId, "Production ID");
  const normalized = normalizePersonInput(input);
  const [productionResult, countResult] = await Promise.all([
    supabase.from("productions").select("*").eq("id", production_id).maybeSingle(),
    supabase
      .from("production_roster")
      .select("id", { count: "exact", head: true })
      .eq("production_id", production_id),
  ]);
  throwOperatorDatabaseError(productionResult.error, "Could not load production.");
  throwOperatorDatabaseError(countResult.error, "Could not load roster.");
  if (!productionResult.data) {
    throw new OperatorDataError("Production not found.", "not_found");
  }
  const production = mapProduction(productionResult.data);
  const person = await insertPerson(supabase, { ...normalized, active: true });
  const { roster, order } = await insertRosterAndOrder(
    supabase,
    production,
    person,
    (countResult.count || 0) + 1,
  );

  if (
    options.linkToClientId &&
    requireId(options.linkToClientId, "Client ID") === production.client_id &&
    (person.type === "client_contact" || person.type === "agency")
  ) {
    const linkResult = await supabase.from("client_people").insert({
      client_id: production.client_id,
      person_id: person.id,
      relationship_notes: null,
      active: true,
    });
    throwOperatorDatabaseError(linkResult.error, "Could not link person to client.");
  }

  return { person, roster, order };
}

export async function updateRoster(
  productionId: string,
  rosterId: string,
  input: UpdateRosterInput,
): Promise<ProductionRoster> {
  const { supabase } = await requireOperatorContext();
  const production_id = requireId(productionId, "Production ID");
  const id = requireId(rosterId, "Roster ID");
  const patch = normalizeRosterPatch(input);
  const result = await supabase
    .from("production_roster")
    .update({
      group_label:
        patch.group_label === undefined ? undefined : nullableText(patch.group_label, 200),
      on_set_today: patch.on_set_today,
    })
    .eq("id", id)
    .eq("production_id", production_id)
    .select("*")
    .maybeSingle();
  throwOperatorDatabaseError(result.error, "Could not update roster.");
  if (!result.data) throw new OperatorDataError("Roster member not found.", "not_found");
  return mapRoster(result.data);
}

export async function removeRoster(
  productionId: string,
  rosterId: string,
): Promise<{ id: string }> {
  const { supabase } = await requireOperatorContext();
  const production_id = requireId(productionId, "Production ID");
  const id = requireId(rosterId, "Roster ID");
  const { error } = await supabase
    .from("production_roster")
    .delete()
    .eq("id", id)
    .eq("production_id", production_id);
  throwOperatorDatabaseError(error, "Could not remove roster member.");
  return { id };
}

async function insertRosterAndOrder(
  supabase: Awaited<ReturnType<typeof requireOperatorContext>>["supabase"],
  production: ReturnType<typeof mapProduction>,
  person: Person,
  sortOrder: number,
) {
  const rosterResult = await supabase
    .from("production_roster")
    .insert({
      production_id: production.id,
      person_id: person.id,
      group_label: person.department || person.company || "Set",
      on_set_today: true,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  throwOperatorDatabaseError(rosterResult.error, "Could not add roster member.");
  const roster = mapRoster(
    requireOperatorRow(rosterResult.data, "Could not add roster member."),
  );
  const orderResult = await supabase
    .from("orders")
    .insert(toInitialOrderInsert(production, roster, person))
    .select("*")
    .single();
  throwOperatorDatabaseError(orderResult.error, "Could not create order draft.");
  return {
    roster,
    order: mapOrder(
      requireOperatorRow(orderResult.data, "Could not create order draft."),
    ),
  };
}
