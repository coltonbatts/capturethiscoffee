import type { Order, RosterOrder } from "./types";

/**
 * The app's collection model is intentionally simpler than the stored
 * `OrderStatus`: a roster person either still needs their drink taken,
 * has a drink captured, or is skipped ("no drink"). Legacy pipeline
 * statuses (confirmed/ordered/picked_up/delivered) all count as captured
 * so historical rows keep working without a migration.
 */
export function isOrderCaptured(order?: Order) {
  return Boolean(
    order && order.status !== "not_asked" && order.status !== "no_order",
  );
}

export function isOrderSkipped(order?: Order) {
  return order?.status === "no_order";
}

export function needsOrder(order?: Order) {
  return !order || order.status === "not_asked";
}

export type CaptureProgress = {
  total: number;
  captured: number;
  skipped: number;
  needed: number;
  printed: number;
  percent: number;
};

/** Drink-collection progress over the on-set roster. */
export function captureProgress(items: RosterOrder[]): CaptureProgress {
  const onSet = items.filter((item) => item.roster.on_set_today);
  let captured = 0;
  let skipped = 0;
  let printed = 0;

  for (const item of onSet) {
    if (isOrderCaptured(item.order)) {
      captured += 1;
      if (item.order?.label_printed) printed += 1;
    } else if (isOrderSkipped(item.order)) {
      skipped += 1;
    }
  }

  const total = onSet.length;
  const needed = total - captured - skipped;
  // Percent tracks decisions made (captured or skipped) so the bar can
  // reach 100% even when someone declines a drink.
  const decided = captured + skipped;

  return {
    total,
    captured,
    skipped,
    needed,
    printed,
    percent: total ? Math.round((decided / total) * 100) : 0,
  };
}
