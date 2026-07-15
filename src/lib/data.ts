"use client";

import { formatDrink } from "./order-summary";
import { normalizeSupabaseWriteError, requireFreshAppSession } from "./auth";
import { getSupabaseBrowserClient } from "./supabase";
import type { Database } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Client,
  ClientPerson,
  CoffeeData,
  Order,
  Person,
  PersonType,
  Production,
  ProductionRoster,
} from "./types";

type NewClientInput = {
  name: string;
  notes?: string;
};

type NewPersonInput = {
  name: string;
  type: PersonType;
  role?: string;
  department?: string;
  company?: string;
  photo_url?: string;
  usual_order?: string;
  dietary_notes?: string;
  notes?: string;
  active?: boolean;
};

type CreatePersonAndRosterOptions = {
  linkToClientId?: string;
};

type UpdateRosterInput = {
  group_label?: string;
  on_set_today?: boolean;
};

type UpdatePersonInput = NewPersonInput;

type NewProductionInput = {
  name: string;
  client_id: string;
  new_client_name?: string;
  shoot_date?: string;
  location?: string;
  runner_name?: string;
  notes?: string;
};

type UpdateProductionInput = {
  name?: string;
  client_id?: string;
  new_client_name?: string;
  shoot_date?: string;
  location?: string;
  runner_name?: string;
  notes?: string;
  status?: Production["status"];
};

const blankToNull = (value?: string) => {
  const next = value?.trim();
  return next ? next : null;
};

const present = (value: string | null | undefined) => value || "";

async function getOperatorSupabase(): Promise<SupabaseClient<Database>> {
  const supabase = getSupabaseBrowserClient();
  await requireFreshAppSession(supabase);
  return supabase;
}

function throwSupabaseWriteError(error: { message: string }): never {
  throw normalizeSupabaseWriteError(error.message);
}

export async function loadCoffeeData(): Promise<CoffeeData> {
  const supabase = await getOperatorSupabase();

  const [
    clientsResult,
    peopleResult,
    clientPeopleResult,
    productionsResult,
    rosterResult,
    ordersResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("people").select("*").order("name", { ascending: true }),
    supabase.from("client_people").select("*"),
    supabase
      .from("productions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("production_roster").select("*").order("sort_order", {
      ascending: true,
    }),
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const error = [
    clientsResult.error,
    peopleResult.error,
    productionsResult.error,
    rosterResult.error,
    ordersResult.error,
  ].find(Boolean);

  if (error) throw new Error(error.message);

  return {
    clients: (clientsResult.data || []).map(mapClient),
    people: (peopleResult.data || []).map(mapPerson),
    client_people: clientPeopleResult.error
      ? []
      : (clientPeopleResult.data || []).map(mapClientPerson),
    productions: (productionsResult.data || []).map(mapProduction),
    production_roster: (rosterResult.data || []).map(mapRoster),
    orders: (ordersResult.data || []).map(mapOrder),
  };
}

export async function loadProductionCoffeeData(
  productionId: string,
): Promise<CoffeeData> {
  if (!productionId) throw new Error("Production ID is required.");
  const supabase = await getOperatorSupabase();

  const { data: production, error: productionError } = await supabase
    .from("productions")
    .select("*")
    .eq("id", productionId)
    .maybeSingle();

  if (productionError) throw new Error(productionError.message);
  if (!production) throw new Error("Production not found.");

  const [clientResult, rosterResult, ordersResult] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", production.client_id)
      .maybeSingle(),
    supabase
      .from("production_roster")
      .select("*")
      .eq("production_id", production.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("orders")
      .select("*")
      .eq("production_id", production.id)
      .order("created_at", { ascending: true }),
  ]);

  const firstError = [
    clientResult.error,
    rosterResult.error,
    ordersResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const roster = rosterResult.data || [];
  const personIds = Array.from(new Set(roster.map((item) => item.person_id)));
  const peopleResult = personIds.length
    ? await supabase.from("people").select("*").in("id", personIds)
    : { data: [], error: null };

  if (peopleResult.error) throw new Error(peopleResult.error.message);

  return {
    clients: clientResult.data ? [mapClient(clientResult.data)] : [],
    people: (peopleResult.data || []).map(mapPerson),
    client_people: [],
    productions: [mapProduction(production)],
    production_roster: roster.map(mapRoster),
    orders: (ordersResult.data || []).map(mapOrder),
  };
}

export async function createClientRecord(
  current: CoffeeData,
  input: NewClientInput,
): Promise<CoffeeData> {
  const name = input.name.trim();
  if (!name) return current;

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name, notes: blankToNull(input.notes), active: true })
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  return { ...current, clients: [mapClient(data), ...current.clients] };
}

export async function createPersonRecord(
  current: CoffeeData,
  input: NewPersonInput,
): Promise<CoffeeData> {
  const name = input.name.trim();
  if (!name) return current;

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("people")
    .insert({
      name,
      type: input.type,
      role: blankToNull(input.role),
      department: blankToNull(input.department),
      company: blankToNull(input.company),
      photo_url: blankToNull(input.photo_url),
      usual_order: blankToNull(input.usual_order),
      dietary_notes: blankToNull(input.dietary_notes),
      notes: blankToNull(input.notes),
      active: input.active ?? true,
    })
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  return { ...current, people: [mapPerson(data), ...current.people] };
}

export async function updatePersonRecord(
  current: CoffeeData,
  personId: string,
  input: UpdatePersonInput,
): Promise<CoffeeData> {
  const name = input.name.trim();
  if (!name) return current;

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("people")
    .update({
      name,
      type: input.type,
      role: blankToNull(input.role),
      department: blankToNull(input.department),
      company: blankToNull(input.company),
      photo_url: blankToNull(input.photo_url),
      usual_order: blankToNull(input.usual_order),
      dietary_notes: blankToNull(input.dietary_notes),
      notes: blankToNull(input.notes),
      active: input.active ?? true,
    })
    .eq("id", personId)
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const updated = mapPerson(data);
  return {
    ...current,
    people: current.people.map((person) =>
      person.id === updated.id ? updated : person,
    ),
  };
}

function findClientByName(data: CoffeeData, name: string) {
  const normalized = name.trim().toLowerCase();
  return data.clients.find(
    (item) => item.active && item.name.trim().toLowerCase() === normalized,
  );
}

export async function createProductionRecord(
  current: CoffeeData,
  input: NewProductionInput,
): Promise<{ data: CoffeeData; production: Production }> {
  const name = input.name.trim();
  if (!name) throw new Error("Production name is required.");
  const newClientName = input.new_client_name?.trim();
  if (!input.client_id && !newClientName) {
    throw new Error("Choose a client or enter a new client name.");
  }

  const supabase = await getOperatorSupabase();
  let clientId = input.client_id;
  let client = current.clients.find((item) => item.id === clientId);

  if (newClientName) {
    const existing = findClientByName(current, newClientName);
    if (existing) {
      client = existing;
      clientId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: newClientName,
          active: true,
        })
        .select("*")
        .single();

      if (error) throwSupabaseWriteError(error);
      client = mapClient(data);
      clientId = client.id;
    }
  }

  const { data: productionRow, error: productionError } = await supabase
    .from("productions")
    .insert({
      name,
      client_id: clientId,
      shoot_date: blankToNull(input.shoot_date),
      location: blankToNull(input.location),
      runner_name: blankToNull(input.runner_name),
      notes: blankToNull(input.notes),
      status: "active",
    })
    .select("*")
    .single();

  if (productionError) throwSupabaseWriteError(productionError);

  const production = mapProduction(productionRow);
  const rosterPeople = defaultRosterPeople(current, clientId);
  const rosterInserts = rosterPeople.map((person, index) => ({
    production_id: production.id,
    person_id: person.id,
    group_label:
      person.department ||
      (person.type === "client_contact" ? client?.name : person.company) ||
      "Set",
    on_set_today: true,
    sort_order: index + 1,
  }));

  if (rosterInserts.length) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("production_roster")
      .insert(rosterInserts)
      .select("*");

    if (rosterError) throwSupabaseWriteError(rosterError);

    const orderInserts: Array<ReturnType<typeof toInitialOrderInsert>> = [];
    (rosterRows || []).forEach((row) => {
      const roster = mapRoster(row);
      const person = rosterPeople.find((item) => item.id === roster.person_id);
      if (person) {
        orderInserts.push(toInitialOrderInsert(production, roster, person));
      }
    });

    if (orderInserts.length) {
      const { error: ordersError } = await supabase
        .from("orders")
        .insert(orderInserts);

      if (ordersError) throwSupabaseWriteError(ordersError);
    }
  }

  return { data: await loadCoffeeData(), production };
}

export async function updateProductionRecord(
  current: CoffeeData,
  productionId: string,
  input: UpdateProductionInput,
): Promise<CoffeeData> {
  const production = current.productions.find(
    (item) => item.id === productionId,
  );
  if (!production) return current;

  const name = input.name === undefined ? production.name : input.name.trim();
  if (!name) throw new Error("Production name is required.");

  let clientId =
    input.client_id === undefined ? production.client_id : input.client_id;
  let nextClients = current.clients;
  const newClientName = input.new_client_name?.trim();

  const supabase = await getOperatorSupabase();

  if (newClientName) {
    const existing = findClientByName(current, newClientName);
    if (existing) {
      clientId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: newClientName,
          active: true,
        })
        .select("*")
        .single();

      if (error) throwSupabaseWriteError(error);
      const newClient = mapClient(data);
      clientId = newClient.id;
      nextClients = [newClient, ...current.clients];
    }
  }

  const patch: Production = {
    ...production,
    name,
    client_id: clientId,
    shoot_date:
      input.shoot_date === undefined
        ? production.shoot_date
        : input.shoot_date.trim(),
    location:
      input.location === undefined
        ? production.location
        : input.location.trim(),
    runner_name:
      input.runner_name === undefined
        ? production.runner_name
        : input.runner_name.trim(),
    notes: input.notes === undefined ? production.notes : input.notes.trim(),
    status: input.status ?? production.status,
  };

  const { data, error } = await supabase
    .from("productions")
    .update({
      name: patch.name,
      client_id: patch.client_id,
      shoot_date: blankToNull(patch.shoot_date),
      location: blankToNull(patch.location),
      runner_name: blankToNull(patch.runner_name),
      notes: blankToNull(patch.notes),
      status: patch.status,
    })
    .eq("id", productionId)
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const updated = mapProduction(data);
  return {
    ...current,
    clients: nextClients,
    productions: current.productions.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
}

export async function updateOrderRecord(
  current: CoffeeData,
  orderId: string,
  patch: Partial<Order>,
): Promise<CoffeeData> {
  const updated_at = new Date().toISOString();

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("orders")
    .update(toOrderUpdate({ ...patch, updated_at }))
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const updated = mapOrder(data);
  return {
    ...current,
    orders: current.orders.map((order) =>
      order.id === orderId ? updated : order,
    ),
  };
}

export async function saveOrderDraft(
  current: CoffeeData,
  orderId: string,
  draft: Partial<Order>,
  options: { updateUsualOrder?: boolean } = {},
): Promise<CoffeeData> {
  const order = current.orders.find((item) => item.id === orderId);
  if (!order) return current;

  const updatedOrder = {
    ...order,
    ...draft,
    status: draft.status || "confirmed",
    updated_at: new Date().toISOString(),
  } satisfies Order;
  const usualOrder = formatDrink(updatedOrder);
  const shouldUpdateUsual =
    options.updateUsualOrder && usualOrder !== "No order";

  const supabase = await getOperatorSupabase();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .update(toOrderUpdate(updatedOrder))
    .eq("id", orderId)
    .select("*")
    .single();

  if (orderError) throwSupabaseWriteError(orderError);

  let nextPeople = current.people;
  if (shouldUpdateUsual) {
    const { data: personRow, error: personError } = await supabase
      .from("people")
      .update({ usual_order: usualOrder })
      .eq("id", updatedOrder.person_id)
      .select("*")
      .single();

    if (personError) throwSupabaseWriteError(personError);
    const updatedPerson = mapPerson(personRow);
    nextPeople = current.people.map((person) =>
      person.id === updatedPerson.id ? updatedPerson : person,
    );
  }

  const savedOrder = mapOrder(orderRow);
  return {
    ...current,
    orders: current.orders.map((item) =>
      item.id === savedOrder.id ? savedOrder : item,
    ),
    people: nextPeople,
  };
}

export async function createPersonAndAddToRoster(
  current: CoffeeData,
  productionId: string,
  input: NewPersonInput,
  options: CreatePersonAndRosterOptions = {},
): Promise<CoffeeData> {
  const name = input.name.trim();
  if (!name) return current;

  const production = current.productions.find(
    (item) => item.id === productionId,
  );
  if (!production) return current;

  const groupLabel =
    input.department?.trim() ||
    input.company?.trim() ||
    input.type.replace("_", " ");
  const shouldLinkToClient =
    Boolean(options.linkToClientId) &&
    options.linkToClientId === production.client_id &&
    (input.type === "client_contact" || input.type === "agency");
  const sortOrder =
    current.production_roster.filter(
      (item) => item.production_id === productionId,
    ).length + 1;

  const supabase = await getOperatorSupabase();
  const { data: personRow, error: personError } = await supabase
    .from("people")
    .insert({
      name,
      type: input.type,
      role: blankToNull(input.role),
      department: blankToNull(input.department),
      company: blankToNull(input.company),
      photo_url: blankToNull(input.photo_url),
      usual_order: blankToNull(input.usual_order),
      dietary_notes: blankToNull(input.dietary_notes),
      notes: blankToNull(input.notes),
      active: true,
    })
    .select("*")
    .single();

  if (personError) throwSupabaseWriteError(personError);
  const person = mapPerson(personRow);

  const { data: rosterRow, error: rosterError } = await supabase
    .from("production_roster")
    .insert({
      production_id: production.id,
      person_id: person.id,
      group_label: blankToNull(groupLabel),
      on_set_today: true,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (rosterError) throwSupabaseWriteError(rosterError);
  const roster = mapRoster(rosterRow);

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(toInitialOrderInsert(production, roster, person))
    .select("*")
    .single();

  if (orderError) throwSupabaseWriteError(orderError);

  let clientLink: ClientPerson | null = null;
  if (shouldLinkToClient && options.linkToClientId) {
    const existing = current.client_people.find(
      (item) =>
        item.client_id === options.linkToClientId &&
        item.person_id === person.id,
    );

    if (existing) {
      const { data: linkRow, error: linkError } = await supabase
        .from("client_people")
        .update({ active: true })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (linkError) throwSupabaseWriteError(linkError);
      clientLink = mapClientPerson(linkRow);
    } else {
      const { data: linkRow, error: linkError } = await supabase
        .from("client_people")
        .insert({
          client_id: options.linkToClientId,
          person_id: person.id,
          relationship_notes: null,
          active: true,
        })
        .select("*")
        .single();

      if (linkError) throwSupabaseWriteError(linkError);
      clientLink = mapClientPerson(linkRow);
    }
  }

  return {
    ...current,
    people: [person, ...current.people],
    production_roster: [roster, ...current.production_roster],
    orders: [mapOrder(orderRow), ...current.orders],
    client_people: clientLink
      ? current.client_people.some((item) => item.id === clientLink.id)
        ? current.client_people.map((item) =>
            item.id === clientLink.id ? clientLink : item,
          )
        : [clientLink, ...current.client_people]
      : current.client_people,
  };
}

export type ClientLinkedPerson = {
  link: ClientPerson;
  person: Person;
};

export function listClientLinkedPeople(
  data: CoffeeData,
  clientId: string,
  options: { activeOnly?: boolean } = {},
): ClientLinkedPerson[] {
  const activeOnly = options.activeOnly ?? true;

  return data.client_people
    .filter(
      (link) => link.client_id === clientId && (!activeOnly || link.active),
    )
    .map((link) => {
      const person = data.people.find((item) => item.id === link.person_id);
      return person ? { link, person } : null;
    })
    .filter((item): item is ClientLinkedPerson => item !== null)
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
}

export async function linkPersonToClient(
  current: CoffeeData,
  clientId: string,
  personId: string,
  relationshipNotes?: string,
): Promise<CoffeeData> {
  const client = current.clients.find((item) => item.id === clientId);
  const person = current.people.find((item) => item.id === personId);
  if (!client || !person) {
    throw new Error("Client or person not found.");
  }

  const existing = current.client_people.find(
    (item) => item.client_id === clientId && item.person_id === personId,
  );
  const notes = relationshipNotes?.trim() ?? existing?.relationship_notes ?? "";

  const supabase = await getOperatorSupabase();
  if (existing) {
    const { data, error } = await supabase
      .from("client_people")
      .update({
        active: true,
        relationship_notes: blankToNull(notes),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throwSupabaseWriteError(error);
    const link = mapClientPerson(data);
    return {
      ...current,
      client_people: current.client_people.map((item) =>
        item.id === link.id ? link : item,
      ),
    };
  }

  const { data, error } = await supabase
    .from("client_people")
    .insert({
      client_id: clientId,
      person_id: personId,
      relationship_notes: blankToNull(notes),
      active: true,
    })
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const link = mapClientPerson(data);
  return { ...current, client_people: [link, ...current.client_people] };
}

export async function unlinkPersonFromClient(
  current: CoffeeData,
  clientId: string,
  personId: string,
): Promise<CoffeeData> {
  const existing = current.client_people.find(
    (item) =>
      item.client_id === clientId && item.person_id === personId && item.active,
  );
  if (!existing) return current;

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("client_people")
    .update({ active: false })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const link = mapClientPerson(data);
  return {
    ...current,
    client_people: current.client_people.map((item) =>
      item.id === link.id ? link : item,
    ),
  };
}

export async function addRosterPerson(
  current: CoffeeData,
  productionId: string,
  personId: string,
): Promise<CoffeeData> {
  const production = current.productions.find(
    (item) => item.id === productionId,
  );
  const person = current.people.find((item) => item.id === personId);
  if (!production || !person) return current;

  const sortOrder =
    current.production_roster.filter(
      (item) => item.production_id === productionId,
    ).length + 1;

  const supabase = await getOperatorSupabase();
  const { data: rosterRow, error: rosterError } = await supabase
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

  if (rosterError) throwSupabaseWriteError(rosterError);

  const roster = mapRoster(rosterRow);
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(toInitialOrderInsert(production, roster, person))
    .select("*")
    .single();

  if (orderError) throwSupabaseWriteError(orderError);

  return {
    ...current,
    production_roster: [roster, ...current.production_roster],
    orders: [mapOrder(orderRow), ...current.orders],
  };
}

export async function updateRosterRecord(
  current: CoffeeData,
  productionId: string,
  rosterId: string,
  input: UpdateRosterInput,
): Promise<CoffeeData> {
  const roster = current.production_roster.find(
    (item) => item.id === rosterId && item.production_id === productionId,
  );
  if (!roster) return current;

  const patch = {
    group_label:
      input.group_label === undefined
        ? roster.group_label
        : input.group_label.trim(),
    on_set_today: input.on_set_today ?? roster.on_set_today,
  };

  const supabase = await getOperatorSupabase();
  const { data, error } = await supabase
    .from("production_roster")
    .update({
      group_label: blankToNull(patch.group_label),
      on_set_today: patch.on_set_today,
    })
    .eq("id", rosterId)
    .eq("production_id", productionId)
    .select("*")
    .single();

  if (error) throwSupabaseWriteError(error);
  const updated = mapRoster(data);
  return {
    ...current,
    production_roster: current.production_roster.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
}

export async function removeRosterRecord(
  current: CoffeeData,
  productionId: string,
  rosterId: string,
): Promise<CoffeeData> {
  const roster = current.production_roster.find(
    (item) => item.id === rosterId && item.production_id === productionId,
  );
  if (!roster) return current;

  const supabase = await getOperatorSupabase();
  const { error } = await supabase
    .from("production_roster")
    .delete()
    .eq("id", rosterId)
    .eq("production_id", productionId);

  if (error) throwSupabaseWriteError(error);

  return {
    ...current,
    production_roster: current.production_roster.filter(
      (item) => item.id !== rosterId,
    ),
    orders: current.orders.filter((order) => order.roster_id !== rosterId),
  };
}

export async function removeProductionRecord(
  current: CoffeeData,
  productionId: string,
): Promise<CoffeeData> {
  const supabase = await getOperatorSupabase();
  const { error } = await supabase
    .from("productions")
    .delete()
    .eq("id", productionId);

  if (error) throwSupabaseWriteError(error);

  return {
    ...current,
    productions: current.productions.filter((p) => p.id !== productionId),
    production_roster: current.production_roster.filter(
      (r) => r.production_id !== productionId,
    ),
    orders: current.orders.filter((o) => o.production_id !== productionId),
  };
}

function defaultRosterPeople(data: CoffeeData, clientId: string) {
  const clientPersonIds = data.client_people
    .filter((item) => item.client_id === clientId && item.active)
    .map((item) => item.person_id);
  const primaryPeople = data.people.filter((person) =>
    clientPersonIds.includes(person.id),
  );
  const crew = data.people
    .filter((person) => person.type === "crew")
    .slice(0, 4);

  return [...primaryPeople, ...crew].filter(
    (person, index, arr) =>
      arr.findIndex((item) => item.id === person.id) === index,
  );
}

function toInitialOrderInsert(
  production: Production,
  roster: ProductionRoster,
  person: Person,
) {
  const parsed = parseUsualOrder(person.usual_order);

  return {
    production_id: production.id,
    roster_id: roster.id,
    person_id: person.id,
    drink_type: blankToNull(parsed.drink_type),
    size: blankToNull(parsed.size),
    temperature: blankToNull(parsed.temperature),
    milk_type: blankToNull(parsed.milk_type),
    sweetener: blankToNull(parsed.sweetener),
    caffeine: "Regular",
    special_notes: blankToNull(parsed.special_notes),
    vendor: null,
    status: "not_asked" as const,
    label_printed: false,
  };
}

function parseUsualOrder(usualOrder = "") {
  const lower = usualOrder.toLowerCase();
  const parts = usualOrder
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const size = ["small", "medium", "large"].find((item) =>
    parts.some((part) => part.toLowerCase() === item),
  );
  const temperature =
    lower.includes("iced") || lower.includes("cold")
      ? "Iced"
      : lower.includes("hot")
        ? "Hot"
        : "";
  const milk = ["oat", "almond", "whole", "cream"].find((item) =>
    lower.includes(item),
  );
  const drinkPart =
    parts.find((part) => {
      const normalized = part.toLowerCase();
      if (size && normalized === size) return false;
      if (["hot", "iced"].includes(normalized)) return false;
      if (milk && normalized === `${milk} milk`) return false;
      return true;
    }) ||
    parts[0] ||
    "";

  return {
    drink_type: drinkPart,
    size: size ? size[0].toUpperCase() + size.slice(1) : "",
    temperature,
    milk_type: milk ? milk[0].toUpperCase() + milk.slice(1) : "",
    sweetener: lower.includes("half sweet")
      ? "Half sweet"
      : lower.includes("sweet")
        ? "Sweetened"
        : "",
    special_notes: parts
      .filter((part) => part !== drinkPart)
      .filter((part) => {
        const normalized = part.toLowerCase();
        if (size && normalized === size) return false;
        if (milk && normalized === `${milk} milk`) return false;
        if (["hot", "iced"].includes(normalized)) return false;
        return true;
      })
      .join(", "),
  };
}

function toOrderUpdate(order: Partial<Order>) {
  return {
    drink_type:
      order.drink_type === undefined
        ? undefined
        : blankToNull(order.drink_type),
    size: order.size === undefined ? undefined : blankToNull(order.size),
    temperature:
      order.temperature === undefined
        ? undefined
        : blankToNull(order.temperature),
    milk_type:
      order.milk_type === undefined ? undefined : blankToNull(order.milk_type),
    sweetener:
      order.sweetener === undefined ? undefined : blankToNull(order.sweetener),
    caffeine:
      order.caffeine === undefined ? undefined : blankToNull(order.caffeine),
    special_notes:
      order.special_notes === undefined
        ? undefined
        : blankToNull(order.special_notes),
    vendor: order.vendor === undefined ? undefined : blankToNull(order.vendor),
    status: order.status,
    label_printed: order.label_printed,
    updated_at: order.updated_at,
  };
}

function mapClient(row: {
  id: string;
  name: string;
  notes: string | null;
  active: boolean;
  created_at: string;
}): Client {
  return {
    id: row.id,
    name: row.name,
    notes: present(row.notes),
    active: row.active,
    created_at: row.created_at,
  };
}

function mapPerson(row: {
  id: string;
  name: string;
  type: PersonType;
  role: string | null;
  department: string | null;
  company: string | null;
  photo_url: string | null;
  usual_order: string | null;
  dietary_notes: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}): Person {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    role: present(row.role),
    department: present(row.department),
    company: present(row.company),
    photo_url: present(row.photo_url),
    usual_order: present(row.usual_order),
    dietary_notes: present(row.dietary_notes),
    notes: present(row.notes),
    active: row.active,
    created_at: row.created_at,
  };
}

function mapClientPerson(row: {
  id: string;
  client_id: string;
  person_id: string;
  relationship_notes: string | null;
  active: boolean;
}): ClientPerson {
  return {
    id: row.id,
    client_id: row.client_id,
    person_id: row.person_id,
    relationship_notes: present(row.relationship_notes),
    active: row.active,
  };
}

function mapProduction(row: {
  id: string;
  name: string;
  client_id: string;
  shoot_date: string | null;
  location: string | null;
  runner_name: string | null;
  notes: string | null;
  status: Production["status"];
  created_at: string;
}): Production {
  return {
    id: row.id,
    name: row.name,
    client_id: row.client_id,
    shoot_date: present(row.shoot_date),
    location: present(row.location),
    runner_name: present(row.runner_name),
    notes: present(row.notes),
    status: row.status,
    created_at: row.created_at,
  };
}

function mapRoster(row: {
  id: string;
  production_id: string;
  person_id: string;
  group_label: string | null;
  on_set_today: boolean;
  sort_order: number;
}): ProductionRoster {
  return {
    id: row.id,
    production_id: row.production_id,
    person_id: row.person_id,
    group_label: present(row.group_label),
    on_set_today: row.on_set_today,
    sort_order: row.sort_order,
  };
}

function mapOrder(row: {
  id: string;
  production_id: string;
  roster_id: string;
  person_id: string;
  drink_type: string | null;
  size: string | null;
  temperature: string | null;
  milk_type: string | null;
  sweetener: string | null;
  caffeine: string | null;
  special_notes: string | null;
  vendor: string | null;
  status: Order["status"];
  label_printed: boolean;
  created_at: string;
  updated_at: string;
}): Order {
  return {
    id: row.id,
    production_id: row.production_id,
    roster_id: row.roster_id,
    person_id: row.person_id,
    drink_type: present(row.drink_type),
    size: present(row.size),
    temperature: present(row.temperature),
    milk_type: present(row.milk_type),
    sweetener: present(row.sweetener),
    caffeine: present(row.caffeine),
    special_notes: present(row.special_notes),
    vendor: present(row.vendor),
    status: row.status,
    label_printed: row.label_printed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
