import type { CoffeeData, Person, RosterOrder } from "./types";

/** Combines active picker candidates with all roster members exactly once. */
export function mergeProductionPeople(
  rosteredPeople: Person[],
  activePeople: Person[],
): Person[] {
  const peopleById = new Map<string, Person>();
  for (const person of rosteredPeople) peopleById.set(person.id, person);
  for (const person of activePeople) peopleById.set(person.id, person);
  return Array.from(peopleById.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function productionRosterItems(
  data: CoffeeData,
  productionId: string,
): RosterOrder[] {
  const peopleById = new Map(data.people.map((person) => [person.id, person]));
  const orderByRoster = new Map(data.orders.map((order) => [order.roster_id, order]));

  return data.production_roster
    .filter((roster) => roster.production_id === productionId)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((roster) => {
      const person = peopleById.get(roster.person_id);
      return person
        ? [{ roster, person, order: orderByRoster.get(roster.id) }]
        : [];
    });
}

export function activePeopleNotOnProductionRoster(
  data: CoffeeData,
  productionId: string,
): Person[] {
  const rosteredPersonIds = new Set(
    data.production_roster
      .filter((roster) => roster.production_id === productionId)
      .map((roster) => roster.person_id),
  );
  return data.people.filter(
    (person) => person.active && !rosteredPersonIds.has(person.id),
  );
}
