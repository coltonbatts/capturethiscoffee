import type { CoffeeLabel, LabelFormatterOptions } from "./label-copy";
import {
  buildPrintableCoffeeLabels,
  defaultPrintableLabelOptions,
  isPrintableLabelItem,
  printableLabelItemsForProduction,
  type PrintableLabelItem,
} from "./label-preparation";
import { formatDrink } from "./order-summary";
import type { Client, CoffeeData, Production, RosterOrder } from "./types";

export const defaultLabelExportOptions = defaultPrintableLabelOptions;

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

export type ActiveLabelExportItem = PrintableLabelItem;

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
  return labelExportProductions(data)[0];
}

/**
 * Batch-first initial selection: a requested single order narrows to that
 * label (reprint/one-off), a requested production selects its whole batch,
 * and otherwise the preferred production's full batch is selected.
 */
export function initialLabelExportSelection(
  data: CoffeeData,
  requestedOrderId = "",
  requestedProductionId = "",
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

  const requestedProduction = labelExportProductions(data).find(
    (production) => production.id === requestedProductionId.trim(),
  );
  const preferred = requestedProduction || preferredLabelExportProduction(data);
  if (!preferred) return { productionId: "", selectedOrderIds: [] };

  return {
    productionId: preferred.id,
    selectedOrderIds: labelExportItemsForProduction(data, preferred.id).map(
      (item) => item.order.id,
    ),
  };
}

/**
 * Keeps an operator's current queue selection when refreshed server props still
 * contain it. If the chosen day disappears, or every previously selected order
 * disappears, fall back to the current preferred batch.
 */
export function reconcileLabelExportSelection(
  data: CoffeeData,
  current: InitialLabelExportSelection,
): InitialLabelExportSelection {
  const productionStillExists = labelExportProductions(data).some(
    (production) => production.id === current.productionId,
  );
  if (!productionStillExists) return initialLabelExportSelection(data);

  const validOrderIds = new Set(
    labelExportItemsForProduction(data, current.productionId).map(
      (item) => item.order.id,
    ),
  );
  const selectedOrderIds = current.selectedOrderIds.filter((id) =>
    validOrderIds.has(id),
  );

  if (current.selectedOrderIds.length > 0 && selectedOrderIds.length === 0) {
    return {
      productionId: current.productionId,
      selectedOrderIds: Array.from(validOrderIds),
    };
  }

  return { productionId: current.productionId, selectedOrderIds };
}

/** Order ids in the batch whose label has not been printed yet. */
export function unprintedOrderIds(items: ActiveLabelExportItem[]) {
  return items
    .filter((item) => !item.order.label_printed)
    .map((item) => item.order.id);
}

export function labelExportItemsForProduction(
  data: CoffeeData,
  productionId: string,
): ActiveLabelExportItem[] {
  return printableLabelItemsForProduction(data, productionId);
}

export function isActiveLabelExportItem(
  item: RosterOrder,
): item is ActiveLabelExportItem {
  return isPrintableLabelItem(item);
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
  const labels = buildPrintableCoffeeLabels(production, client, items, options);

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
