export type PersonType = "client_contact" | "agency" | "crew" | "guest";

export type OrderStatus =
  | "not_asked"
  | "confirmed"
  | "ordered"
  | "picked_up"
  | "delivered"
  | "no_order";

export type ProductionStatus = "planning" | "active" | "complete";

export type Client = {
  id: string;
  name: string;
  notes?: string;
  active: boolean;
  created_at: string;
};

export type Person = {
  id: string;
  name: string;
  type: PersonType;
  role?: string;
  department?: string;
  company?: string;
  photo_url?: string;
  usual_order?: string;
  dietary_notes?: string;
  notes?: string;
  active: boolean;
  created_at: string;
};

export type ClientPerson = {
  id: string;
  client_id: string;
  person_id: string;
  relationship_notes?: string;
  active: boolean;
};

export type Production = {
  id: string;
  name: string;
  client_id: string;
  shoot_date: string;
  location?: string;
  runner_name?: string;
  notes?: string;
  status: ProductionStatus;
  created_at: string;
};

export type ProductionRoster = {
  id: string;
  production_id: string;
  person_id: string;
  group_label?: string;
  on_set_today: boolean;
  sort_order: number;
};

export type Order = {
  id: string;
  production_id: string;
  roster_id: string;
  person_id: string;
  drink_type?: string;
  size?: string;
  temperature?: string;
  milk_type?: string;
  sweetener?: string;
  caffeine?: string;
  special_notes?: string;
  vendor?: string;
  status: OrderStatus;
  label_printed: boolean;
  created_at: string;
  updated_at: string;
};

export type CoffeeData = {
  clients: Client[];
  people: Person[];
  client_people: ClientPerson[];
  productions: Production[];
  production_roster: ProductionRoster[];
  orders: Order[];
};

export type RosterOrder = {
  roster: ProductionRoster;
  person: Person;
  order?: Order;
};
