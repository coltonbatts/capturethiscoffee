import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId } from "@/lib/label-designs";
import {
  buildPrintableCoffeeLabels,
  printableLabelItemsForProduction,
  type PrintableLabelItem,
} from "@/lib/label-preparation";
import { formatDrink } from "@/lib/order-summary";
import type { Client, CoffeeData, Order, Production } from "@/lib/types";

export type PrinterQueueItem = {
  orderId: string;
  personName: string;
  drink: string;
  group: string;
  status: Order["status"];
  labelPrinted: boolean;
};

export type PrinterQueueResponse = {
  production: {
    id: string;
    name: string;
    status: string;
  };
  designId: typeof defaultLabelDesignId;
  labels: PrinterQueueItem[];
};

export function buildPrinterQueue(data: CoffeeData, productionId: string): PrinterQueueResponse | null {
  const production = data.productions.find((item) => item.id === productionId);
  if (!production) return null;

  const items = printableLabelItemsForProduction(data, productionId);
  const labels = items.map((item) => ({
    orderId: item.order.id,
    personName: item.person.name,
    drink: formatDrink(item.order),
    group: item.roster.group_label || item.person.department || "Set",
    status: item.order.status,
    labelPrinted: item.order.label_printed,
  }));

  return {
    production: {
      id: production.id,
      name: production.name,
      status: production.status,
    },
    designId: defaultLabelDesignId,
    labels,
  };
}

export function findCoffeeLabelForOrder(
  data: CoffeeData,
  productionId: string,
  orderId: string,
): CoffeeLabel | null {
  const production = data.productions.find((item) => item.id === productionId);
  if (!production) return null;

  const client = data.clients.find((item) => item.id === production.client_id);
  const items = printableLabelItemsForProduction(data, productionId).filter(
    (item) => item.order.id === orderId,
  );
  if (!items.length) return null;

  const labels = buildPrintableCoffeeLabels(production, client, items);

  return labels[0] || null;
}

export function buildCoffeeLabelForOrder(context: {
  production: Pick<Production, "name">;
  client: Pick<Client, "name"> | undefined;
  item: PrintableLabelItem;
}): CoffeeLabel | null {
  return (
    buildPrintableCoffeeLabels(context.production, context.client, [context.item])[0] ||
    null
  );
}

export function parseProductionShareUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const match = url.pathname.match(/\/productions\/([^/]+)\/?$/);
    if (!match) return null;

    const token = url.searchParams.get("token") || "";
    if (!token) return null;

    return {
      productionId: decodeURIComponent(match[1]),
      token,
      origin: url.origin,
    };
  } catch {
    return null;
  }
}
