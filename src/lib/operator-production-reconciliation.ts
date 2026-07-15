import type { CoffeeData, Order } from "./types";

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (!incoming.length) return current;
  const nextById = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) nextById.set(item.id, item);
  return Array.from(nextById.values());
}

export function mergeProductionOrders(
  current: Order[],
  incoming: Order[],
  productionId: string,
  pendingOrderIds: ReadonlySet<string>,
) {
  const currentById = new Map(current.map((order) => [order.id, order]));
  const incomingProductionOrders = incoming.filter(
    (order) => order.production_id === productionId,
  );
  const incomingIds = new Set(incomingProductionOrders.map((order) => order.id));
  const pendingOnlyLocal = current.filter(
    (order) =>
      order.production_id === productionId &&
      pendingOrderIds.has(order.id) &&
      !incomingIds.has(order.id),
  );

  return [
    ...current.filter((order) => order.production_id !== productionId),
    ...incomingProductionOrders.map((order) =>
      pendingOrderIds.has(order.id) ? currentById.get(order.id) || order : order,
    ),
    ...pendingOnlyLocal,
  ];
}

export function mergeProductionCoffeeData(
  current: CoffeeData,
  incoming: CoffeeData,
  productionId: string,
  pendingOrderIds: ReadonlySet<string>,
): CoffeeData {
  return {
    clients: mergeById(current.clients, incoming.clients),
    // The scoped query already returns the complete rostered + active picker
    // union. Replace it so people who become inactive and are not rostered do
    // not linger as stale picker candidates after a refresh.
    people: incoming.people,
    client_people: current.client_people,
    productions: mergeById(current.productions, incoming.productions),
    production_roster: [
      ...current.production_roster.filter(
        (item) => item.production_id !== productionId,
      ),
      ...incoming.production_roster.filter(
        (item) => item.production_id === productionId,
      ),
    ],
    orders: mergeProductionOrders(
      current.orders,
      incoming.orders,
      productionId,
      pendingOrderIds,
    ),
  };
}
