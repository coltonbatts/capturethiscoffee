"use client";

import { useMemo } from "react";
import { formatDrink } from "@/lib/order-summary";
import type {
  CoffeeData,
  Order,
  OrderStatus,
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

export type RosterStateFilter = "on_set" | "all" | "off_set";

export type RosterFilters = {
  query: string;
  groupFilter: string;
  statusFilter: OrderStatus | "all";
  rosterStateFilter: RosterStateFilter;
};

export function groupLabelFor(item: RosterOrder) {
  return item.roster.group_label || item.person.department || "Set";
}

/**
 * Derives every view-model the dashboard renders from the raw `CoffeeData`
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

  const groups = useMemo(
    () =>
      Array.from(new Set(activeItems.map(groupLabelFor))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [activeItems],
  );

  const visibleItems = useMemo(() => {
    if (filters.rosterStateFilter === "all") return items;
    if (filters.rosterStateFilter === "off_set") {
      return items.filter((item) => !item.roster.on_set_today);
    }
    return activeItems;
  }, [items, activeItems, filters.rosterStateFilter]);

  const filteredItems = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();

    return visibleItems.filter((item) => {
      const matchesGroup =
        filters.groupFilter === "all" ||
        groupLabelFor(item) === filters.groupFilter;
      const matchesStatus =
        filters.statusFilter === "all" ||
        item.order?.status === filters.statusFilter;
      if (!matchesGroup || !matchesStatus) return false;
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
  }, [visibleItems, filters.query, filters.groupFilter, filters.statusFilter]);

  const progress = useMemo(() => {
    const total = activeItems.length;
    let responded = 0;
    let confirmed = 0;
    let delivered = 0;
    for (const item of activeItems) {
      const status = item.order?.status;
      if (status && status !== "not_asked") responded += 1;
      if (status === "confirmed") confirmed += 1;
      if (status === "delivered") delivered += 1;
    }
    return {
      total,
      responded,
      confirmed,
      delivered,
      percent: total ? Math.round((responded / total) * 100) : 0,
    };
  }, [activeItems]);

  const offSetCount = useMemo(
    () => items.filter((item) => !item.roster.on_set_today).length,
    [items],
  );

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
    groups,
    filteredItems,
    progress,
    offSetCount,
    peopleNotOnRoster,
  };
}
