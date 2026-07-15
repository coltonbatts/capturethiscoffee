import "server-only";

import type { Database } from "@/lib/supabase";
import type {
  Client,
  ClientPerson,
  Order,
  Person,
  Production,
  ProductionRoster,
} from "@/lib/types";

type Tables = Database["public"]["Tables"];
const present = (value: string | null | undefined) => value || "";

export function mapClient(row: Tables["clients"]["Row"]): Client {
  return { ...row, notes: present(row.notes) };
}

export function mapPerson(row: Tables["people"]["Row"]): Person {
  return {
    ...row,
    role: present(row.role),
    department: present(row.department),
    company: present(row.company),
    photo_url: present(row.photo_url),
    usual_order: present(row.usual_order),
    dietary_notes: present(row.dietary_notes),
    notes: present(row.notes),
  };
}

export function mapClientPerson(
  row: Tables["client_people"]["Row"],
): ClientPerson {
  return { ...row, relationship_notes: present(row.relationship_notes) };
}

export function mapProduction(
  row: Tables["productions"]["Row"],
): Production {
  return {
    ...row,
    shoot_date: present(row.shoot_date),
    location: present(row.location),
    runner_name: present(row.runner_name),
    notes: present(row.notes),
  };
}

export function mapRoster(
  row: Tables["production_roster"]["Row"],
): ProductionRoster {
  return { ...row, group_label: present(row.group_label) };
}

export function mapOrder(row: Tables["orders"]["Row"]): Order {
  return {
    ...row,
    drink_type: present(row.drink_type),
    size: present(row.size),
    temperature: present(row.temperature),
    milk_type: present(row.milk_type),
    sweetener: present(row.sweetener),
    caffeine: present(row.caffeine),
    special_notes: present(row.special_notes),
    vendor: present(row.vendor),
  };
}
