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

export function toRunnerCoffeeData(aggregate: ProductionAggregate): CoffeeData {
  return {
    clients: aggregate.client ? [toRunnerClient(aggregate.client)] : [],
    people: aggregate.people.map(toRunnerPerson),
    client_people: [],
    productions: [toRunnerProduction(aggregate.production)],
    production_roster: aggregate.roster.map(toRunnerRoster),
    orders: aggregate.orders.map(toRunnerOrder),
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
