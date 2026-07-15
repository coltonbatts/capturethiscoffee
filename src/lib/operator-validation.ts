import type {
  NewClientInput,
  NewPersonInput,
  NewProductionInput,
  OrderPatch,
  UpdateProductionInput,
  UpdateRosterInput,
} from "./operator-inputs";
import type { OrderStatus, PersonType, ProductionStatus } from "./types";

export class OperatorInputError extends Error {}

const personTypes = new Set<PersonType>([
  "client_contact",
  "agency",
  "crew",
  "guest",
]);
const productionStatuses = new Set<ProductionStatus>([
  "planning",
  "active",
  "complete",
]);
const orderStatuses = new Set<OrderStatus>([
  "not_asked",
  "confirmed",
  "ordered",
  "picked_up",
  "delivered",
  "no_order",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireId(value: unknown, label: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!uuidPattern.test(id)) {
    throw new OperatorInputError(`${label} is invalid.`);
  }
  return id;
}

export function optionalText(value: unknown, max = 1000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function nullableText(value: unknown, max = 1000): string | null {
  return optionalText(value, max) || null;
}

export function requiredText(
  value: unknown,
  label: string,
  max = 200,
): string {
  const text = optionalText(value, max);
  if (!text) {
    throw new OperatorInputError(`${label} is required.`);
  }
  return text;
}

export function normalizeClientInput(input: NewClientInput): NewClientInput {
  return {
    name: requiredText(input?.name, "Client name"),
    notes: optionalText(input?.notes),
  };
}

export function normalizePersonInput(input: NewPersonInput): NewPersonInput {
  const type = personTypes.has(input?.type) ? input.type : "guest";
  return {
    name: requiredText(input?.name, "Name"),
    type,
    role: optionalText(input?.role, 200),
    department: optionalText(input?.department, 200),
    company: optionalText(input?.company, 200),
    photo_url: optionalText(input?.photo_url, 2048),
    usual_order: optionalText(input?.usual_order, 500),
    dietary_notes: optionalText(input?.dietary_notes, 500),
    notes: optionalText(input?.notes, 2000),
    active: input?.active !== false,
  };
}

export function normalizeNewProductionInput(
  input: NewProductionInput,
): NewProductionInput {
  return {
    name: requiredText(input?.name, "Production name"),
    client_id: optionalText(input?.client_id, 100),
    new_client_name: optionalText(input?.new_client_name, 200),
    shoot_date: optionalText(input?.shoot_date, 20),
    location: optionalText(input?.location, 500),
    runner_name: optionalText(input?.runner_name, 200),
    notes: optionalText(input?.notes, 2000),
  };
}

export function normalizeProductionPatch(
  input: UpdateProductionInput,
): UpdateProductionInput {
  const status = productionStatuses.has(input?.status as ProductionStatus)
    ? input.status
    : undefined;
  return {
    name: input.name === undefined ? undefined : requiredText(input.name, "Production name"),
    client_id: input.client_id === undefined ? undefined : optionalText(input.client_id, 100),
    new_client_name:
      input.new_client_name === undefined
        ? undefined
        : optionalText(input.new_client_name, 200),
    shoot_date:
      input.shoot_date === undefined ? undefined : optionalText(input.shoot_date, 20),
    location:
      input.location === undefined ? undefined : optionalText(input.location, 500),
    runner_name:
      input.runner_name === undefined
        ? undefined
        : optionalText(input.runner_name, 200),
    notes: input.notes === undefined ? undefined : optionalText(input.notes, 2000),
    status,
  };
}

export function normalizeRosterPatch(input: UpdateRosterInput): UpdateRosterInput {
  return {
    group_label:
      input.group_label === undefined
        ? undefined
        : optionalText(input.group_label, 200),
    on_set_today:
      typeof input.on_set_today === "boolean" ? input.on_set_today : undefined,
  };
}

export function normalizeOrderPatch(input: OrderPatch): OrderPatch {
  const patch: OrderPatch = {};
  for (const key of [
    "drink_type",
    "size",
    "temperature",
    "milk_type",
    "sweetener",
    "caffeine",
    "special_notes",
    "vendor",
  ] as const) {
    if (input?.[key] !== undefined) patch[key] = optionalText(input[key], 500);
  }
  if (orderStatuses.has(input?.status as OrderStatus)) patch.status = input.status;
  if (typeof input?.label_printed === "boolean") {
    patch.label_printed = input.label_printed;
  }
  if (!Object.keys(patch).length) {
    throw new OperatorInputError("No valid order fields were provided.");
  }
  return patch;
}
