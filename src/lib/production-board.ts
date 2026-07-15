import type { Order, RosterOrder } from "./types";
import { isOrderCaptured, isOrderSkipped, needsOrder } from "./order-progress";
import { formatDrink } from "./order-summary";
import type {
  ProductionBoardDTO,
  ProductionBoardOrderDTO,
  ProductionBoardRosterDTO,
} from "@/server/productions/dto";

export type {
  ProductionBoardDTO,
  ProductionBoardOrderDTO,
  ProductionBoardRosterDTO,
};

export function toProductionBoardOrder(
  order: Order,
): ProductionBoardOrderDTO {
  return {
    id: order.id,
    drink_type: order.drink_type || "",
    size: order.size || "",
    temperature: order.temperature || "",
    milk_type: order.milk_type || "",
    sweetener: order.sweetener || "",
    caffeine: order.caffeine || "",
    special_notes: order.special_notes || "",
    vendor: order.vendor || "",
    status: order.status,
    label_printed: order.label_printed,
    updated_at: order.updated_at,
  };
}
export function toProductionBoardRosterItem(
  item: RosterOrder,
): ProductionBoardRosterDTO {
  return {
    roster_id: item.roster.id,
    group_label: item.roster.group_label || "",
    on_set_today: item.roster.on_set_today,
    sort_order: item.roster.sort_order,
    person: {
      id: item.person.id,
      name: item.person.name,
      role: item.person.role || "",
      department: item.person.department || "",
      company: item.person.company || "",
      photo_url: item.person.photo_url || "",
      usual_order: item.person.usual_order || "",
    },
    order: item.order ? toProductionBoardOrder(item.order) : null,
  };
}

/** Replaces one joined order while preserving every other roster row. */
export function replaceProductionBoardOrder(
  board: ProductionBoardDTO,
  orderId: string,
  order: ProductionBoardOrderDTO,
): ProductionBoardDTO {
  return {
    ...board,
    roster: board.roster.map((item) =>
      item.order?.id === orderId ? { ...item, order } : item,
    ),
  };
}

/**
 * Applies a poll snapshot without overwriting orders that still have a local
 * optimistic request in flight.
 */
export function reconcileProductionBoard(
  current: ProductionBoardDTO,
  incoming: ProductionBoardDTO,
  pendingOrderIds: ReadonlySet<string>,
): ProductionBoardDTO {
  if (!pendingOrderIds.size) return incoming;

  const currentPendingOrders = new Map(
    current.roster.flatMap((item) =>
      item.order && pendingOrderIds.has(item.order.id)
        ? [[item.order.id, item.order] as const]
        : [],
    ),
  );

  return {
    ...incoming,
    roster: incoming.roster.map((item) => {
      if (!item.order || !pendingOrderIds.has(item.order.id)) return item;
      const pendingOrder = currentPendingOrders.get(item.order.id);
      return pendingOrder ? { ...item, order: pendingOrder } : item;
    }),
  };
}

export function filterProductionBoardRoster(
  roster: ProductionBoardRosterDTO[],
  filters: { query: string; needsOnly: boolean },
) {
  const needle = filters.query.trim().toLowerCase();

  return roster.filter((item) => {
    if (filters.needsOnly && !needsOrder(item.order)) return false;
    if (!needle) return true;

    return [
      item.person.name,
      item.person.role,
      item.person.department,
      item.person.usual_order,
      formatDrink(item.order),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function captureProductionBoardProgress(
  roster: ProductionBoardRosterDTO[],
) {
  let captured = 0;
  let skipped = 0;
  let printed = 0;

  for (const item of roster) {
    if (isOrderCaptured(item.order)) {
      captured += 1;
      if (item.order?.label_printed) printed += 1;
    } else if (isOrderSkipped(item.order)) {
      skipped += 1;
    }
  }

  const total = roster.length;
  const needed = total - captured - skipped;
  return {
    total,
    captured,
    skipped,
    needed,
    printed,
    percent: total ? Math.round(((captured + skipped) / total) * 100) : 0,
  };
}
