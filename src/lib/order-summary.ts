import type { Client, Order, Production, RosterOrder } from "./types";

export function formatDrink(order?: Order) {
  if (!order || order.status === "no_order") return "No order";

  const parts = [
    order.size,
    order.temperature,
    order.drink_type,
    order.milk_type ? `${order.milk_type} milk` : "",
    order.sweetener,
    order.caffeine && order.caffeine !== "Regular" ? order.caffeine : "",
    order.special_notes,
  ].filter(Boolean);

  return parts.join(", ") || "Order not entered";
}

export function byPersonSummary(items: RosterOrder[]) {
  return items
    .filter(({ order }) => order && order.status !== "no_order")
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
