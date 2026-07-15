import "server-only";

import type { CoffeeData } from "@/lib/types";
import { mergeProductionPeople } from "@/lib/operator-production-people";
import { requireOperatorContext } from "./context";
import { OperatorDataError, throwOperatorDatabaseError } from "./errors";
import {
  mapClient,
  mapClientPerson,
  mapOrder,
  mapPerson,
  mapProduction,
  mapRoster,
} from "./mappers";
import { requireId } from "./validation";

const emptyData = (): CoffeeData => ({
  clients: [],
  people: [],
  client_people: [],
  productions: [],
  production_roster: [],
  orders: [],
});

export async function getProductionsPageData(): Promise<CoffeeData> {
  const { supabase } = await requireOperatorContext();
  const [clients, productions, orders] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase
      .from("productions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("*").order("created_at", { ascending: true }),
  ]);
  throwOperatorDatabaseError(clients.error, "Could not load clients.");
  throwOperatorDatabaseError(productions.error, "Could not load productions.");
  throwOperatorDatabaseError(orders.error, "Could not load orders.");
  return {
    ...emptyData(),
    clients: (clients.data || []).map(mapClient),
    productions: (productions.data || []).map(mapProduction),
    orders: (orders.data || []).map(mapOrder),
  };
}

export async function getPeoplePageData(): Promise<CoffeeData> {
  const { supabase } = await requireOperatorContext();
  const result = await supabase
    .from("people")
    .select("*")
    .order("name", { ascending: true });
  throwOperatorDatabaseError(result.error, "Could not load people.");
  return { ...emptyData(), people: (result.data || []).map(mapPerson) };
}

export async function getLabelsPageData(): Promise<CoffeeData> {
  const { supabase } = await requireOperatorContext();
  const [clients, people, productions, roster, orders] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("people").select("*").order("name", { ascending: true }),
    supabase
      .from("productions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("production_roster")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("orders").select("*").order("created_at", { ascending: true }),
  ]);
  throwOperatorDatabaseError(clients.error, "Could not load clients.");
  throwOperatorDatabaseError(people.error, "Could not load people.");
  throwOperatorDatabaseError(productions.error, "Could not load productions.");
  throwOperatorDatabaseError(roster.error, "Could not load rosters.");
  throwOperatorDatabaseError(orders.error, "Could not load orders.");
  return {
    ...emptyData(),
    clients: (clients.data || []).map(mapClient),
    people: (people.data || []).map(mapPerson),
    productions: (productions.data || []).map(mapProduction),
    production_roster: (roster.data || []).map(mapRoster),
    orders: (orders.data || []).map(mapOrder),
  };
}

/** Loads one production aggregate plus the active people picker. */
export async function getProductionPageData(
  productionId: string,
): Promise<CoffeeData> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(productionId, "Production ID");
  const productionResult = await supabase
    .from("productions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOperatorDatabaseError(productionResult.error, "Could not load production.");
  if (!productionResult.data) {
    throw new OperatorDataError("Production not found.", "not_found");
  }

  const [client, roster, orders] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", productionResult.data.client_id)
      .maybeSingle(),
    supabase
      .from("production_roster")
      .select("*")
      .eq("production_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("orders")
      .select("*")
      .eq("production_id", id)
      .order("created_at", { ascending: true }),
  ]);
  throwOperatorDatabaseError(client.error, "Could not load client.");
  throwOperatorDatabaseError(roster.error, "Could not load roster.");
  throwOperatorDatabaseError(orders.error, "Could not load orders.");

  const rosterRows = (roster.data || []).map(mapRoster);
  const rosterPersonIds = Array.from(
    new Set(rosterRows.map((item) => item.person_id)),
  );
  const [activePeople, rosteredPeople] = await Promise.all([
    supabase
      .from("people")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true }),
    rosterPersonIds.length
      ? supabase
          .from("people")
          .select("*")
          .in("id", rosterPersonIds)
          .order("name", { ascending: true })
      : Promise.resolve(null),
  ]);
  throwOperatorDatabaseError(activePeople.error, "Could not load people.");
  if (rosteredPeople) {
    throwOperatorDatabaseError(rosteredPeople.error, "Could not load roster members.");
  }

  return {
    ...emptyData(),
    clients: client.data ? [mapClient(client.data)] : [],
    people: mergeProductionPeople(
      (rosteredPeople?.data || []).map(mapPerson),
      (activePeople.data || []).map(mapPerson),
    ),
    productions: [mapProduction(productionResult.data)],
    production_roster: rosterRows,
    orders: (orders.data || []).map(mapOrder),
  };
}

export async function getNewProductionPageData(): Promise<{
  activeClientCount: number;
}> {
  const { supabase } = await requireOperatorContext();
  const result = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  throwOperatorDatabaseError(result.error, "Could not prepare a new production.");
  return { activeClientCount: result.count || 0 };
}

export async function getClientPeopleData(): Promise<CoffeeData> {
  const { supabase } = await requireOperatorContext();
  const [clients, people, links] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("people").select("*"),
    supabase.from("client_people").select("*"),
  ]);
  throwOperatorDatabaseError(clients.error, "Could not load clients.");
  throwOperatorDatabaseError(people.error, "Could not load people.");
  throwOperatorDatabaseError(links.error, "Could not load client relationships.");
  return {
    ...emptyData(),
    clients: (clients.data || []).map(mapClient),
    people: (people.data || []).map(mapPerson),
    client_people: (links.data || []).map(mapClientPerson),
  };
}
