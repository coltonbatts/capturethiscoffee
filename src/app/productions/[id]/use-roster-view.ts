"use client";

import { useMemo } from "react";
import { captureProgress, needsOrder } from "@/lib/order-progress";
import { formatDrink } from "@/lib/order-summary";
import {
  activePeopleNotOnProductionRoster,
  productionRosterItems,
} from "@/lib/operator-production-people";
import type {
  CoffeeData,
  Production,
  RosterOrder,
} from "@/lib/types";

export type RosterFilters = {
  query: string;
  /** Show only people whose drink still needs to be captured. */
  needsOnly: boolean;
};

/**
 * Derives every view-model the day board renders from the raw `CoffeeData`
 * blob plus the active filters. The roster join is a single O(n) pass over
 * indexed Maps rather than the old nested `people.find` / `orders.find` per
 * roster row, so re-deriving after each optimistic tap stays cheap even on a
 * large roster.
 */
export function useRosterView(
  data: CoffeeData | null,
  production: Production | undefined,
  filters: RosterFilters,
) {
  const items = useMemo<RosterOrder[]>(() => {
    if (!data || !production) return [];
    return productionRosterItems(data, production.id);
  }, [data, production]);

  const activeItems = useMemo(
    () => items.filter((item) => item.roster.on_set_today),
    [items],
  );

  const filteredItems = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();

    return activeItems.filter((item) => {
      if (filters.needsOnly && !needsOrder(item.order)) return false;
      if (!needle) return true;

      const haystack = [
        item.person.name,
        item.person.role,
        item.person.department,
        item.person.usual_order,
        formatDrink(item.order),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [activeItems, filters.query, filters.needsOnly]);

  const progress = useMemo(() => captureProgress(activeItems), [activeItems]);

  const peopleNotOnRoster = useMemo(() => {
    if (!data || !production) return [];
    return activePeopleNotOnProductionRoster(data, production.id);
  }, [data, production]);

  return {
    items,
    activeItems,
    filteredItems,
    progress,
    peopleNotOnRoster,
  };
}
