import {
  buildCoffeeLabels,
  defaultLabelFields,
  type CoffeeLabel,
  type LabelFormatterOptions,
} from "./label-copy";
import { isOrderCaptured } from "./order-progress";
import type { Client, CoffeeData, Production, RosterOrder } from "./types";

export const defaultPrintableLabelOptions: LabelFormatterOptions = {
  style: "standard",
  fields: {
    ...defaultLabelFields,
    notesStatus: false,
  },
};

export type PrintableLabelItem = RosterOrder & {
  order: NonNullable<RosterOrder["order"]>;
};

export function printableLabelItemsForProduction(
  data: CoffeeData,
  productionId: string,
): PrintableLabelItem[] {
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
          order: data.orders.find(
            (order) =>
              order.roster_id === roster.id &&
              order.production_id === productionId &&
              order.person_id === roster.person_id,
          ),
        },
      ];
    })
    .filter(isPrintableLabelItem);
}

export function isPrintableLabelItem(item: RosterOrder): item is PrintableLabelItem {
  // Waiting and declined orders do not produce labels. All later operational
  // statuses remain printable for initial runs and reprints.
  return isOrderCaptured(item.order);
}

export function buildPrintableCoffeeLabels(
  production: Pick<Production, "name">,
  client: Pick<Client, "name"> | undefined,
  items: RosterOrder[],
  options: LabelFormatterOptions = defaultPrintableLabelOptions,
): CoffeeLabel[] {
  return buildCoffeeLabels(production, client, items, options);
}
