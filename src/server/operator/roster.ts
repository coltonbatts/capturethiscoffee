import "server-only";

import type {
  CreatePersonAndRosterOptions,
  NewPersonInput,
  UpdateRosterInput,
} from "@/lib/operator-inputs";
import type { Database } from "@/lib/supabase";
import type { Order, Person, ProductionRoster } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  throwOperatorDatabaseError,
} from "./errors";
import { mapOrder, mapPerson, mapRoster } from "./mappers";
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
  const result = await supabase.rpc("setup_add_person_to_roster", {
    p_production_id: production_id,
    p_person_id: person_id,
  });
  throwOperatorDatabaseError(result.error, "Could not add roster member.");
  const payload = requireSetupResult(result.data, "Could not add roster member.");
  return {
    roster: mapRoster(payload.roster),
    order: mapOrder(payload.order),
  };
}

export async function createPersonAndAddToRoster(
  productionId: string,
  input: NewPersonInput,
  options: CreatePersonAndRosterOptions = {},
): Promise<{ person: Person; roster: ProductionRoster; order: Order }> {
  const { supabase } = await requireOperatorContext();
  const production_id = requireId(productionId, "Production ID");
  const normalized = normalizePersonInput(input);
  const linkToClient = options.linkToClientId != null;
  if (options.linkToClientId) {
    const requestedClientId = requireId(options.linkToClientId, "Client ID");
    const productionResult = await supabase
      .from("productions")
      .select("client_id")
      .eq("id", production_id)
      .maybeSingle();
    throwOperatorDatabaseError(
      productionResult.error,
      "Could not load production.",
    );
    if (!productionResult.data) {
      throw new OperatorDataError("Production not found.", "not_found");
    }
    if (requestedClientId !== productionResult.data.client_id) {
      throw new OperatorDataError(
        "Client does not match this production.",
        "validation",
      );
    }
  }
  const result = await supabase.rpc("setup_create_person_and_add_to_roster", {
    p_production_id: production_id,
    p_name: normalized.name,
    p_type: normalized.type,
    p_role: nullableText(normalized.role, 200),
    p_department: nullableText(normalized.department, 200),
    p_company: nullableText(normalized.company, 200),
    p_photo_url: nullableText(normalized.photo_url, 2048),
    p_usual_order: nullableText(normalized.usual_order, 500),
    p_dietary_notes: nullableText(normalized.dietary_notes, 500),
    p_notes: nullableText(normalized.notes, 2000),
    p_link_to_client: linkToClient,
  });
  throwOperatorDatabaseError(result.error, "Could not quick add person.");
  const payload = requireSetupResult(result.data, "Could not quick add person.");
  return {
    person: mapPerson(payload.person),
    roster: mapRoster(payload.roster),
    order: mapOrder(payload.order),
  };
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

type SetupResult = {
  person: Database["public"]["Tables"]["people"]["Row"];
  roster: Database["public"]["Tables"]["production_roster"]["Row"];
  order: Database["public"]["Tables"]["orders"]["Row"];
};

function requireSetupResult(value: unknown, message: string): SetupResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperatorDataError(message, "database");
  }
  const payload = value as Partial<SetupResult>;
  if (!payload.person || !payload.roster || !payload.order) {
    throw new OperatorDataError(message, "database");
  }
  return payload as SetupResult;
}
