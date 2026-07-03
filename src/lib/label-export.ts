import {
  buildCoffeeLabels,
  defaultLabelFields,
  type CoffeeLabel,
  type LabelFormatterOptions,
} from "./label-copy";
import { formatDrink } from "./order-summary";
import type { Client, CoffeeData, Production, RosterOrder } from "./types";

export const defaultLabelExportOptions: LabelFormatterOptions = {
  style: "standard",
  fields: {
    ...defaultLabelFields,
    notesStatus: false,
  },
};

export type LabelExportSelection = {
  production: Production;
  client: Client | undefined;
  items: ActiveLabelExportItem[];
  labels: CoffeeLabel[];
};

export type InitialLabelExportSelection = {
  productionId: string;
  selectedOrderIds: string[];
};

export type ActiveLabelExportItem = RosterOrder & {
  order: NonNullable<RosterOrder["order"]>;
};

export function labelExportProductions(data: CoffeeData) {
  return data.productions
    .filter((production) => production.status === "active" || production.status === "planning")
    .slice()
    .sort((a, b) => {
      const statusRank = productionStatusRank(a.status) - productionStatusRank(b.status);
      if (statusRank !== 0) return statusRank;
      return b.created_at.localeCompare(a.created_at);
    });
}

export function preferredLabelExportProduction(data: CoffeeData) {
  return (
    labelExportProductions(data)[0] ||
    data.productions.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  );
}

export function initialLabelExportSelection(
  data: CoffeeData,
  requestedOrderId = "",
): InitialLabelExportSelection {
  const requested = requestedOrderId.trim();
  if (requested) {
    for (const production of labelExportProductions(data)) {
      const item = labelExportItemsForProduction(data, production.id).find(
        (candidate) => candidate.order.id === requested,
      );
      if (item) {
        return { productionId: production.id, selectedOrderIds: [item.order.id] };
      }
    }
  }

  const preferred = preferredLabelExportProduction(data);
  if (!preferred) return { productionId: "", selectedOrderIds: [] };

  const firstOrderId =
    labelExportItemsForProduction(data, preferred.id)[0]?.order.id || "";

  return {
    productionId: preferred.id,
    selectedOrderIds: firstOrderId ? [firstOrderId] : [],
  };
}

export function labelExportItemsForProduction(
  data: CoffeeData,
  productionId: string,
): ActiveLabelExportItem[] {
  return data.production_roster
    .filter((roster) => roster.production_id === productionId && roster.on_set_today)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((roster) => {
      const person = data.people.find((item) => item.id === roster.person_id);
      if (!person) return [];

      return [
        {
          roster,
          person,
          order: data.orders.find((order) => order.roster_id === roster.id),
        },
      ];
    })
    .filter(isActiveLabelExportItem);
}

export function isActiveLabelExportItem(
  item: RosterOrder,
): item is ActiveLabelExportItem {
  return Boolean(item.order && item.order.status !== "no_order");
}

export function buildLabelExportSelection(
  data: CoffeeData,
  productionId: string,
  selectedOrderIds: string[],
  options: LabelFormatterOptions = defaultLabelExportOptions,
): LabelExportSelection | null {
  const production = data.productions.find((item) => item.id === productionId);
  if (!production) return null;

  const client = data.clients.find((item) => item.id === production.client_id);
  const allItems = labelExportItemsForProduction(data, productionId);
  const selected = new Set(selectedOrderIds);
  const items = allItems.filter((item) => item.order && selected.has(item.order.id));
  const labels = buildCoffeeLabels(production, client, items, options);

  return { production, client, items, labels };
}

function productionStatusRank(status: Production["status"]) {
  if (status === "active") return 0;
  if (status === "planning") return 1;
  return 2;
}

/**
 * CSV consumed by NIIMBOT batch/variable-data templates: a header row plus
 * one "crew name","drink" row per selected order. Cells are always quoted and
 * newlines flattened so the NIIMBOT app import never splits a row.
 */
export function niimbotBatchCsv(items: ActiveLabelExportItem[]) {
  return [
    ["crew name", "drink"],
    ...items.map((item) => [item.person.name, formatDrink(item.order)]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function csvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}
