import "server-only";

import type { Database } from "@/lib/supabase";
import type { Person, Production, ProductionRoster } from "@/lib/types";
import { nullableText } from "./validation";

export function toInitialOrderInsert(
  production: Production,
  roster: ProductionRoster,
  person: Person,
): Database["public"]["Tables"]["orders"]["Insert"] {
  const parsed = parseUsualOrder(person.usual_order);
  return {
    production_id: production.id,
    roster_id: roster.id,
    person_id: person.id,
    drink_type: nullableText(parsed.drink_type),
    size: nullableText(parsed.size),
    temperature: nullableText(parsed.temperature),
    milk_type: nullableText(parsed.milk_type),
    sweetener: nullableText(parsed.sweetener),
    caffeine: "Regular",
    special_notes: nullableText(parsed.special_notes),
    vendor: null,
    status: "not_asked",
    label_printed: false,
  };
}

export function parseUsualOrder(usualOrder = "") {
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
