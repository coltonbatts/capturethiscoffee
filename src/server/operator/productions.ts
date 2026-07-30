import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NewProductionInput,
  UpdateProductionInput,
} from "@/lib/operator-inputs";
import type { Database } from "@/lib/supabase";
import type { Client, Production } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  requireOperatorRow,
  throwOperatorDatabaseError,
} from "./errors";
import { mapClient, mapProduction } from "./mappers";
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

  const productionResult = await supabase.rpc("setup_create_day", {
    p_name: normalized.name,
    p_client_id: normalized.client_id || null,
    p_client_name: nullableText(normalized.new_client_name, 200),
    p_shoot_date: nullableText(normalized.shoot_date, 20),
    p_location: nullableText(normalized.location, 500),
    p_runner_name: nullableText(normalized.runner_name, 200),
    p_notes: nullableText(normalized.notes, 2000),
    // Build 13 days begin in Planning so a published label template can be
    // reviewed/assigned before activation freezes the physical output.
    p_status: "planning",
    p_seed_default_roster: true,
  });
  throwOperatorDatabaseError(
    productionResult.error,
    "Could not create production.",
  );
  const payload = requireObject(
    productionResult.data,
    "Could not create production.",
  );
  return mapProduction(
    requireOperatorRow(
      payload.production as
        | Database["public"]["Tables"]["productions"]["Row"]
        | null,
      "Could not create production.",
    ),
  );
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

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperatorDataError(message, "database");
  }
  return value as Record<string, unknown>;
}
