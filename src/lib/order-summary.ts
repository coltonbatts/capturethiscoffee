import type { Client, Order, Production, RosterOrder } from "./types";

export function formatDrink(order?: Order) {
  if (!order || order.status === "no_order") return "No order";

  let drink = cleanPart(order.drink_type);
  let notes = cleanPart(order.special_notes);
  const size = labelFromKnownValue(order.size, sizeLabels);
  const temperature = labelFromKnownValue(order.temperature, temperatureLabels);
  const milk = formatMilk(order.milk_type);

  if (size && sameMeaning(drink, size)) drink = "";
  if (temperature && sameMeaning(drink, temperature)) drink = "";

  if (looksLikeDrink(notes) && (!drink || sameMeaning(drink, size))) {
    drink = notes;
    notes = "";
  }

  const parts = [
    size && !containsMeaning(drink, size) ? size : "",
    temperature && !containsMeaning(drink, temperature) ? temperature : "",
    drink,
    milk && !containsMeaning(drink, milk) ? milk : "",
    cleanPart(order.sweetener),
    order.caffeine && order.caffeine !== "Regular" ? cleanPart(order.caffeine) : "",
    notes,
  ].filter(Boolean);

  return parts.join(", ") || "Order not entered";
}

const sizeLabels: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const temperatureLabels: Record<string, string> = {
  hot: "Hot",
  iced: "Iced",
};

function cleanPart(value?: string) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function labelFromKnownValue(value: string | undefined, labels: Record<string, string>) {
  const clean = cleanPart(value);
  if (!clean) return "";
  return labels[normalize(clean)] || clean;
}

function formatMilk(value?: string) {
  const clean = cleanPart(value);
  if (!clean) return "";
  return /\bmilk\b/i.test(clean) ? clean : `${capitalize(clean)} milk`;
}

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function normalize(value?: string) {
  return cleanPart(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameMeaning(a?: string, b?: string) {
  return Boolean(a && b && normalize(a) === normalize(b));
}

function containsMeaning(haystack?: string, needle?: string) {
  const normalizedHaystack = ` ${normalize(haystack)} `;
  const normalizedNeedle = normalize(needle);
  if (!normalizedHaystack.trim() || !normalizedNeedle) return false;

  if (normalizedHaystack.includes(` ${normalizedNeedle} `)) return true;

  if (normalizedNeedle.endsWith(" milk")) {
    const milkBase = normalizedNeedle.replace(/\s+milk$/, "");
    return normalizedHaystack.includes(` ${milkBase} `);
  }

  return false;
}

function looksLikeDrink(value: string) {
  return /\b(latte|coffee|cold brew|matcha|tea|chai|americano|cappuccino|espresso|mocha|drip|cortado|macchiato|flat white)\b/i.test(
    value,
  );
}

export function byPersonSummary(items: RosterOrder[]) {
  return items
    .filter(
      ({ roster, order }) =>
        roster.on_set_today && order && order.status !== "no_order",
    )
    .map(({ person, roster, order }) => ({
      name: person.name,
      group: roster.group_label || person.department || "Set",
      order: formatDrink(order),
      status: order?.status || "not_asked",
    }));
}

export function groupedByDrinkSummary(items: RosterOrder[]) {
  const grouped = new Map<
    string,
    { order: string; count: number; people: string[]; groups: string[] }
  >();

  for (const item of items) {
    if (!item.roster.on_set_today) continue;
    if (!item.order || item.order.status === "no_order") continue;

    const drink = formatDrink(item.order);
    const current = grouped.get(drink) || {
      order: drink,
      count: 0,
      people: [],
      groups: [],
    };

    current.count += 1;
    current.people.push(item.person.name);
    current.groups.push(item.roster.group_label || item.person.department || "Set");
    grouped.set(drink, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
}

export function plainTextCoffeeSummary(
  production: Production,
  client: Client | undefined,
  items: RosterOrder[],
) {
  const byDrink = groupedByDrinkSummary(items);
  const byPerson = byPersonSummary(items);

  return [
    `COFFEE ORDER - ${production.name}`,
    client ? `Client: ${client.name}` : "",
    production.shoot_date ? `Date: ${production.shoot_date}` : "",
    production.location ? `Location: ${production.location}` : "",
    "",
    "GROUPED BY DRINK",
    ...byDrink.flatMap((drink) => [
      `${drink.count}x ${drink.order}`,
      `   ${drink.people.join(", ")}`,
    ]),
    "",
    "BY PERSON",
    ...byPerson.map(
      (item) => `${item.name} (${item.group}) - ${item.order} [${item.status}]`,
    ),
  ]
    .filter((line, index, arr) => line || arr[index - 1])
    .join("\n");
}
