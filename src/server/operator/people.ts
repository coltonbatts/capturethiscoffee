import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewPersonInput, UpdatePersonInput } from "@/lib/operator-inputs";
import type { Database } from "@/lib/supabase";
import type { Person } from "@/lib/types";
import { requireOperatorContext } from "./context";
import { requireOperatorRow, throwOperatorDatabaseError } from "./errors";
import { mapPerson } from "./mappers";
import { normalizePersonInput, nullableText, requireId } from "./validation";

export async function createPerson(input: NewPersonInput): Promise<Person> {
  const { supabase } = await requireOperatorContext();
  return insertPerson(supabase, normalizePersonInput(input));
}

export async function updatePerson(
  personId: string,
  input: UpdatePersonInput,
): Promise<Person> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(personId, "Person ID");
  const normalized = normalizePersonInput(input);
  const { data, error } = await supabase
    .from("people")
    .update(toPersonWrite(normalized))
    .eq("id", id)
    .select("*")
    .maybeSingle();

  throwOperatorDatabaseError(error, "Could not update person.");
  return mapPerson(requireOperatorRow(data, "Person not found."));
}

export async function insertPerson(
  supabase: SupabaseClient<Database>,
  input: NewPersonInput,
): Promise<Person> {
  const { data, error } = await supabase
    .from("people")
    .insert(toPersonWrite(input))
    .select("*")
    .single();

  throwOperatorDatabaseError(error, "Could not create person.");
  return mapPerson(requireOperatorRow(data, "Could not create person."));
}

function toPersonWrite(input: NewPersonInput) {
  return {
    name: input.name,
    type: input.type,
    role: nullableText(input.role, 200),
    department: nullableText(input.department, 200),
    company: nullableText(input.company, 200),
    photo_url: nullableText(input.photo_url, 2048),
    usual_order: nullableText(input.usual_order, 500),
    dietary_notes: nullableText(input.dietary_notes, 500),
    notes: nullableText(input.notes, 2000),
    active: input.active !== false,
  };
}
