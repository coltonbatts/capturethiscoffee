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
  const { data, error } = await supabase.rpc("setup_update_person", {
    p_person_id: id,
    p_name: normalized.name,
    p_type: normalized.type,
    p_role: nullableText(normalized.role, 200),
    p_department: nullableText(normalized.department, 200),
    p_company: nullableText(normalized.company, 200),
    p_photo_url: nullableText(normalized.photo_url, 2048),
    p_usual_order: nullableText(normalized.usual_order, 500),
    p_dietary_notes: nullableText(normalized.dietary_notes, 500),
    p_notes: nullableText(normalized.notes, 2000),
    p_active: normalized.active !== false,
  });

  throwOperatorDatabaseError(error, "Could not update person.");
  return mapPerson(
    requireOperatorRow(data as PersonRow | null, "Person not found."),
  );
}

export async function insertPerson(
  supabase: SupabaseClient<Database>,
  input: NewPersonInput,
): Promise<Person> {
  const { data, error } = await supabase.rpc("setup_create_person", {
    p_name: input.name,
    p_type: input.type,
    p_role: nullableText(input.role, 200),
    p_department: nullableText(input.department, 200),
    p_company: nullableText(input.company, 200),
    p_photo_url: nullableText(input.photo_url, 2048),
    p_usual_order: nullableText(input.usual_order, 500),
    p_dietary_notes: nullableText(input.dietary_notes, 500),
    p_notes: nullableText(input.notes, 2000),
    p_active: input.active !== false,
  });

  throwOperatorDatabaseError(error, "Could not create person.");
  return mapPerson(
    requireOperatorRow(data as PersonRow | null, "Could not create person."),
  );
}

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
