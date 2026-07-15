import type { Database } from "@/lib/supabase";
import type {
  Client,
  CoffeeData,
  Order,
  Person,
  Production,
  ProductionRoster,
  RosterOrder,
} from "@/lib/types";
import { isOrderCaptured } from "@/lib/order-progress";

type ProductionRow = Database["public"]["Tables"]["productions"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type RosterRow = Database["public"]["Tables"]["production_roster"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type RunnerProductionSource = Pick<
  ProductionRow,
  | "id"
  | "name"
  | "client_id"
  | "shoot_date"
  | "location"
  | "runner_name"
  | "status"
  | "created_at"
> &
  Partial<Pick<ProductionRow, "notes">>;

export type RunnerClientSource = Pick<
  ClientRow,
  "id" | "name" | "active" | "created_at"
> &
  Partial<Pick<ClientRow, "notes">>;

export type RunnerPersonSource = Pick<
  PersonRow,
  | "id"
  | "name"
  | "type"
  | "role"
  | "department"
  | "company"
  | "photo_url"
  | "usual_order"
  | "active"
  | "created_at"
> &
  Partial<Pick<PersonRow, "dietary_notes" | "notes">>;

export type RunnerRosterSource = RosterRow;
export type RunnerOrderSource = OrderRow;

export type ProductionAggregate = {
  production: RunnerProductionSource;
  client: RunnerClientSource | null;
  people: RunnerPersonSource[];
  roster: RunnerRosterSource[];
  orders: RunnerOrderSource[];
};

export type ProductionBoardOrderDTO = {
  id: string;
  drink_type: string;
  size: string;
  temperature: string;
  milk_type: string;
  sweetener: string;
  caffeine: string;
  special_notes: string;
  vendor: string;
  status: Order["status"];
  label_printed: boolean;
  updated_at: string;
};

export type ProductionBoardRosterDTO = {
  roster_id: string;
  group_label: string;
  on_set_today: boolean;
  sort_order: number;
  person: {
    id: string;
    name: string;
    role: string;
    department: string;
    company: string;
    photo_url: string;
    usual_order: string;
  };
  order: ProductionBoardOrderDTO | null;
};

export type ProductionBoardDTO = {
  production: {
    id: string;
    name: string;
    shoot_date: string;
    location: string;
    runner_name: string;
    status: Production["status"];
    client_name: string;
  };
  roster: ProductionBoardRosterDTO[];
};

export type OrderLabelSource = {
  production: RunnerProductionSource;
  client: RunnerClientSource | null;
  person: RunnerPersonSource;
  roster: RunnerRosterSource;
  order: RunnerOrderSource;
};

export type OrderLabelContext = {
  production: Production;
  client: Client | undefined;
  item: RosterOrder & { order: Order };
};

export function toPrinterCoffeeData(aggregate: ProductionAggregate): CoffeeData {
  return {
    clients: aggregate.client ? [toRunnerClient(aggregate.client)] : [],
    people: aggregate.people.map(toRunnerPerson),
    client_people: [],
    productions: [toRunnerProduction(aggregate.production)],
    production_roster: aggregate.roster.map(toRunnerRoster),
    orders: aggregate.orders.map(toRunnerOrder),
  };
}

/**
 * Joins the production aggregate into the exact render model exposed to a
 * token-scoped runner. The whitelist here is the privacy boundary: private
 * notes, client relationships, unrelated people, and off-set roster members
 * never enter the DTO.
 */
export function toProductionBoardDTO(
  aggregate: ProductionAggregate,
): ProductionBoardDTO {
  const peopleById = new Map(
    aggregate.people.map((person) => [person.id, person]),
  );
  const ordersByRosterId = new Map<string, RunnerOrderSource>();

  for (const order of aggregate.orders) {
    if (order.production_id !== aggregate.production.id) continue;
    if (!ordersByRosterId.has(order.roster_id)) {
      ordersByRosterId.set(order.roster_id, order);
    }
  }

  const roster = aggregate.roster
    .filter(
      (item) =>
        item.production_id === aggregate.production.id && item.on_set_today,
    )
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((item): ProductionBoardRosterDTO[] => {
      const person = peopleById.get(item.person_id);
      if (!person) return [];

      const order = ordersByRosterId.get(item.id);
      const matchingOrder =
        order &&
        order.person_id === person.id &&
        order.production_id === item.production_id
          ? toProductionBoardOrderDTO(order)
          : null;

      return [
        {
          roster_id: item.id,
          group_label: item.group_label || "",
          on_set_today: item.on_set_today,
          sort_order: item.sort_order,
          person: {
            id: person.id,
            name: person.name,
            role: person.role || "",
            department: person.department || "",
            company: person.company || "",
            photo_url: person.photo_url || "",
            usual_order: person.usual_order || "",
          },
          order: matchingOrder,
        },
      ];
    });

  return {
    production: {
      id: aggregate.production.id,
      name: aggregate.production.name,
      shoot_date: aggregate.production.shoot_date || "",
      location: aggregate.production.location || "",
      runner_name: aggregate.production.runner_name || "",
      status: aggregate.production.status,
      client_name: aggregate.client?.name || "",
    },
    roster,
  };
}

export function toOrderLabelContext(source: OrderLabelSource): OrderLabelContext | null {
  const production = toRunnerProduction(source.production);
  const roster = toRunnerRoster(source.roster);
  const person = toRunnerPerson(source.person);
  const order = toRunnerOrder(source.order);

  if (
    roster.production_id !== production.id ||
    order.production_id !== production.id ||
    order.roster_id !== roster.id ||
    order.person_id !== roster.person_id ||
    roster.person_id !== person.id ||
    !roster.on_set_today ||
    !isOrderCaptured(order)
  ) {
    return null;
  }

  return {
    production,
    client: source.client ? toRunnerClient(source.client) : undefined,
    item: { roster, person, order },
  };
}

function toRunnerProduction(row: RunnerProductionSource): Production {
  return {
    id: row.id,
    name: row.name,
    client_id: row.client_id,
    shoot_date: row.shoot_date || "",
    location: row.location || "",
    runner_name: row.runner_name || "",
    notes: "",
    status: row.status,
    created_at: row.created_at,
  };
}

function toRunnerClient(row: RunnerClientSource): Client {
  return {
    id: row.id,
    name: row.name,
    notes: "",
    active: row.active,
    created_at: row.created_at,
  };
}

function toRunnerPerson(row: RunnerPersonSource): Person {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    role: row.role || "",
    department: row.department || "",
    company: row.company || "",
    photo_url: row.photo_url || "",
    usual_order: row.usual_order || "",
    dietary_notes: "",
    notes: "",
    active: row.active,
    created_at: row.created_at,
  };
}

function toRunnerRoster(row: RunnerRosterSource): ProductionRoster {
  return {
    id: row.id,
    production_id: row.production_id,
    person_id: row.person_id,
    group_label: row.group_label || "",
    on_set_today: row.on_set_today,
    sort_order: row.sort_order,
  };
}

export function toRunnerOrder(row: RunnerOrderSource): Order {
  return {
    id: row.id,
    production_id: row.production_id,
    roster_id: row.roster_id,
    person_id: row.person_id,
    drink_type: row.drink_type || "",
    size: row.size || "",
    temperature: row.temperature || "",
    milk_type: row.milk_type || "",
    sweetener: row.sweetener || "",
    caffeine: row.caffeine || "",
    special_notes: row.special_notes || "",
    vendor: row.vendor || "",
    status: row.status,
    label_printed: row.label_printed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toProductionBoardOrderDTO(
  row: RunnerOrderSource,
): ProductionBoardOrderDTO {
  return {
    id: row.id,
    drink_type: row.drink_type || "",
    size: row.size || "",
    temperature: row.temperature || "",
    milk_type: row.milk_type || "",
    sweetener: row.sweetener || "",
    caffeine: row.caffeine || "",
    special_notes: row.special_notes || "",
    vendor: row.vendor || "",
    status: row.status,
    label_printed: row.label_printed,
    updated_at: row.updated_at,
  };
}
