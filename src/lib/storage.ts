"use client";

import { seedData } from "./seed";
import type {
  Client,
  CoffeeData,
  Order,
  Person,
  Production,
  ProductionRoster,
} from "./types";

const storageKey = "capture-this-coffee-data-v1";
const removedExampleNames = new Set([
  "Ava Chen",
  "Marcus Reed",
  "Jules Rivera",
  "Sam Patel",
  "Mia Torres",
]);

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function cloneSeedData(): CoffeeData {
  return JSON.parse(JSON.stringify(seedData)) as CoffeeData;
}

export function loadCoffeeData(): CoffeeData {
  if (typeof window === "undefined") {
    return cloneSeedData();
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    const data = cloneSeedData();
    saveCoffeeData(data);
    return data;
  }

  try {
    const data = removeExamplePeople(JSON.parse(raw) as CoffeeData);
    if (data.changed) saveCoffeeData(data.value);
    return data.value;
  } catch {
    const data = cloneSeedData();
    saveCoffeeData(data);
    return data;
  }
}

function removeExamplePeople(data: CoffeeData): { value: CoffeeData; changed: boolean } {
  const removedPersonIds = new Set(
    data.people
      .filter((person) => removedExampleNames.has(person.name))
      .map((person) => person.id),
  );

  if (!removedPersonIds.size) return { value: data, changed: false };

  const removedRosterIds = new Set(
    data.production_roster
      .filter((roster) => removedPersonIds.has(roster.person_id))
      .map((roster) => roster.id),
  );

  return {
    changed: true,
    value: {
      ...data,
      people: data.people.filter((person) => !removedPersonIds.has(person.id)),
      client_people: data.client_people.filter(
        (link) => !removedPersonIds.has(link.person_id),
      ),
      production_roster: data.production_roster.filter(
        (roster) => !removedPersonIds.has(roster.person_id),
      ),
      orders: data.orders.filter(
        (order) =>
          !removedPersonIds.has(order.person_id) &&
          !removedRosterIds.has(order.roster_id),
      ),
    },
  };
}

export function saveCoffeeData(data: CoffeeData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function createEmptyOrder(
  production: Production,
  roster: ProductionRoster,
  person: Person,
): Order {
  const now = new Date().toISOString();
  const parsed = parseUsualOrder(person.usual_order);

  return {
    id: createId("order"),
    production_id: production.id,
    roster_id: roster.id,
    person_id: person.id,
    drink_type: parsed.drink_type,
    size: parsed.size,
    temperature: parsed.temperature,
    milk_type: parsed.milk_type,
    sweetener: parsed.sweetener,
    caffeine: "Regular",
    special_notes: parsed.special_notes,
    vendor: "",
    status: "not_asked",
    label_printed: false,
    created_at: now,
    updated_at: now,
  };
}

export function buildProductionRoster(
  production: Production,
  client: Client | undefined,
  people: Person[],
  existingClientPersonIds: string[],
) {
  const primaryPeople = people.filter((person) =>
    existingClientPersonIds.includes(person.id),
  );
  const crew = people.filter((person) => person.type === "crew").slice(0, 4);
  const uniquePeople = [...primaryPeople, ...crew].filter(
    (person, index, arr) => arr.findIndex((item) => item.id === person.id) === index,
  );

  return uniquePeople.map((person, index) => ({
    roster: {
      id: createId("roster"),
      production_id: production.id,
      person_id: person.id,
      group_label:
        person.department ||
        (person.type === "client_contact" ? client?.name : person.company) ||
        "Set",
      on_set_today: true,
      sort_order: index + 1,
    } satisfies ProductionRoster,
    person,
  }));
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
  const temperature = lower.includes("iced") || lower.includes("cold") ? "Iced" : lower.includes("hot") ? "Hot" : "";
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
    }) || parts[0] || "";

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
