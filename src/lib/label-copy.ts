import { formatDrink } from "./order-summary";
import type { Client, OrderStatus, Production, RosterOrder } from "./types";

export type LabelContentStyle = "compact" | "standard" | "detailed";

export type LabelFieldOptions = {
  personName: boolean;
  drink: boolean;
  group: boolean;
  productionClient: boolean;
  notesStatus: boolean;
};

export type LabelFormatterOptions = {
  style: LabelContentStyle;
  fields: LabelFieldOptions;
};

export type CoffeeLabel = {
  id: string;
  personName: string;
  drink: string;
  group: string;
  productionClient: string;
  notesStatus: string;
  title: string;
  bodyLines: string[];
  footerStart: string;
  footerEnd: string;
  lines: string[];
};

type ActiveLabelItem = RosterOrder & {
  order: NonNullable<RosterOrder["order"]>;
};

const statusCopy: Record<OrderStatus, string> = {
  not_asked: "Not asked",
  confirmed: "Confirmed",
  ordered: "Ordered",
  picked_up: "Picked up",
  delivered: "Delivered",
  no_order: "No order",
};

export const defaultLabelFields: LabelFieldOptions = {
  personName: true,
  drink: true,
  group: true,
  productionClient: true,
  notesStatus: false,
};

export const defaultLabelOptions: LabelFormatterOptions = {
  style: "standard",
  fields: defaultLabelFields,
};

export function activeOrderItems(items: RosterOrder[]): ActiveLabelItem[] {
  return items.filter(
    (item): item is ActiveLabelItem =>
      item.roster.on_set_today &&
      Boolean(item.order) &&
      item.order?.status !== "no_order",
  );
}

export function buildCoffeeLabels(
  production: Pick<Production, "name">,
  client: Pick<Client, "name"> | undefined,
  items: RosterOrder[],
  options: LabelFormatterOptions,
): CoffeeLabel[] {
  return activeOrderItems(items).map((item) => {
    const group = item.roster.group_label || item.person.department || "Set";
    const drink = formatDrink(item.order);
    const productionClient = [production.name, client?.name].filter(Boolean).join(" / ");
    const notesStatus = [item.order.special_notes, statusCopy[item.order.status]]
      .filter(Boolean)
      .join(" / ");

    const label: CoffeeLabel = {
      id: item.order?.id || item.roster.id,
      personName: item.person.name,
      drink,
      group,
      productionClient,
      notesStatus,
      title: "",
      bodyLines: [],
      footerStart: "",
      footerEnd: "",
      lines: [],
    };

    const layout = labelLayout(label, options);
    label.title = layout.title;
    label.bodyLines = layout.bodyLines;
    label.footerStart = layout.footerStart;
    label.footerEnd = layout.footerEnd;
    label.lines = labelLines(layout);
    return label;
  });
}

export function labelToText(label: CoffeeLabel, options: LabelFormatterOptions) {
  return labelLines(labelLayout(label, options)).join("\n");
}

export function labelsToText(labels: CoffeeLabel[], options: LabelFormatterOptions) {
  return labels.map((label) => labelToText(label, options)).join("\n\n");
}

function labelLines(layout: {
  title: string;
  bodyLines: string[];
  footerStart: string;
  footerEnd: string;
}) {
  return [
    layout.title,
    ...layout.bodyLines,
    [layout.footerStart, layout.footerEnd].filter(Boolean).join(" - "),
  ].filter(Boolean);
}

function labelLayout(label: CoffeeLabel, options: LabelFormatterOptions) {
  const { fields, style } = options;

  if (style === "compact") {
    const title = fields.personName
      ? label.personName
      : fields.drink
        ? label.drink
        : fields.group
          ? label.group
          : "";
    return {
      title,
      bodyLines: fields.personName && fields.drink ? [label.drink] : [],
      footerStart: fields.group ? label.group : "",
      footerEnd: "",
    };
  }

  if (style === "detailed") {
    const title = fields.personName
      ? label.personName
      : fields.drink
        ? label.drink
        : fields.group
          ? label.group
          : "";
    return {
      title,
      bodyLines: [
        fields.personName && fields.drink ? label.drink : "",
        fields.notesStatus ? label.notesStatus : "",
      ].filter(Boolean),
      footerStart: fields.group ? label.group : "",
      footerEnd: fields.productionClient ? label.productionClient : "",
    };
  }

  const title = fields.personName
    ? label.personName
    : fields.drink
      ? label.drink
      : fields.group
        ? label.group
        : "";
  return {
    title,
    bodyLines: [
      fields.personName && fields.drink ? label.drink : "",
      fields.notesStatus ? label.notesStatus : "",
    ].filter(Boolean),
    footerStart: fields.group ? label.group : "",
    footerEnd: fields.productionClient ? label.productionClient : "",
  };
}
