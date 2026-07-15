import "server-only";

import type { NewClientInput } from "@/lib/operator-inputs";
import type { Client, ClientPerson } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  requireOperatorRow,
  throwOperatorDatabaseError,
} from "./errors";
import { mapClient, mapClientPerson } from "./mappers";
import {
  normalizeClientInput,
  nullableText,
  optionalText,
  requireId,
} from "./validation";

export async function createClient(input: NewClientInput): Promise<Client> {
  const { supabase } = await requireOperatorContext();
  const normalized = normalizeClientInput(input);
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: normalized.name,
      notes: nullableText(normalized.notes),
      active: true,
    })
    .select("*")
    .single();

  throwOperatorDatabaseError(error, "Could not create client.");
  return mapClient(requireOperatorRow(data, "Could not create client."));
}

export async function updateClient(
  clientId: string,
  input: NewClientInput & { active?: boolean },
): Promise<Client> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(clientId, "Client ID");
  const normalized = normalizeClientInput(input);
  const { data, error } = await supabase
    .from("clients")
    .update({
      name: normalized.name,
      notes: nullableText(normalized.notes),
      active: input.active !== false,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  throwOperatorDatabaseError(error, "Could not update client.");
  if (!data) throw new OperatorDataError("Client not found.", "not_found");
  return mapClient(data);
}

export async function linkPersonToClient(
  clientId: string,
  personId: string,
  relationshipNotes?: string,
): Promise<ClientPerson> {
  const { supabase } = await requireOperatorContext();
  const client_id = requireId(clientId, "Client ID");
  const person_id = requireId(personId, "Person ID");
  const notes = nullableText(relationshipNotes, 500);

  const existingResult = await supabase
    .from("client_people")
    .select("*")
    .eq("client_id", client_id)
    .eq("person_id", person_id)
    .maybeSingle();
  throwOperatorDatabaseError(existingResult.error, "Could not link person.");

  const result = existingResult.data
    ? await supabase
        .from("client_people")
        .update({ active: true, relationship_notes: notes })
        .eq("id", existingResult.data.id)
        .select("*")
        .single()
    : await supabase
        .from("client_people")
        .insert({
          client_id,
          person_id,
          relationship_notes: notes,
          active: true,
        })
        .select("*")
        .single();

  throwOperatorDatabaseError(result.error, "Could not link person.");
  return mapClientPerson(requireOperatorRow(result.data, "Could not link person."));
}

export async function unlinkPersonFromClient(
  clientId: string,
  personId: string,
): Promise<{ clientId: string; personId: string }> {
  const { supabase } = await requireOperatorContext();
  const client_id = requireId(clientId, "Client ID");
  const person_id = requireId(personId, "Person ID");
  const { error } = await supabase
    .from("client_people")
    .update({ active: false })
    .eq("client_id", client_id)
    .eq("person_id", person_id);

  throwOperatorDatabaseError(error, "Could not unlink person.");
  return { clientId: client_id, personId: person_id };
}

export function normalizeRelationshipNotes(value?: string): string {
  return optionalText(value, 500);
}
