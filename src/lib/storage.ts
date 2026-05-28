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
    return JSON.parse(raw) as CoffeeData;
  } catch {
    const data = cloneSeedData();
    saveCoffeeData(data);
    return data;
  }
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

  return {
    drink_type: parts[0] || "",
    size: ["small", "medium", "large"].find((size) => lower.includes(size)) || "",
    temperature: lower.includes("iced") || lower.includes("cold") ? "Iced" : lower.includes("hot") ? "Hot" : "",
    milk_type: ["oat", "almond", "whole", "cream"].find((milk) =>
      lower.includes(milk),
    ) || "",
    sweetener: lower.includes("half sweet")
      ? "Half sweet"
      : lower.includes("sweet")
        ? "Sweetened"
        : "",
    special_notes: parts.slice(1).join(", "),
  };
}
