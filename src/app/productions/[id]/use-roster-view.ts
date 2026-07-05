"use client";

import { useMemo } from "react";
import { captureProgress, needsOrder } from "@/lib/order-progress";
import { formatDrink } from "@/lib/order-summary";
import type {
  CoffeeData,
  Order,
  Person,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";

type JoinedRosterRow = {
  roster: ProductionRoster;
  person: Person | undefined;
  order?: Order;
};

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

    const peopleById = new Map(data.people.map((person) => [person.id, person]));
    const orderByRoster = new Map<string, Order>();
    for (const order of data.orders) orderByRoster.set(order.roster_id, order);

    return data.production_roster
      .filter((roster) => roster.production_id === production.id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (roster): JoinedRosterRow => ({
          roster,
          person: peopleById.get(roster.person_id),
          order: orderByRoster.get(roster.id),
        }),
      )
      .filter((item): item is RosterOrder => Boolean(item.person));
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
    if (!data) return [];
    const rostered = new Set(items.map((item) => item.person.id));
    return data.people.filter(
      (person) => !rostered.has(person.id) && person.active,
    );
  }, [data, items]);

  return {
    items,
    activeItems,
    filteredItems,
    progress,
    peopleNotOnRoster,
  };
}
