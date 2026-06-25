import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase";
import type { CoffeeData, Order } from "./types";

export const runnerOrderFields = [
  "drink_type",
  "size",
  "temperature",
  "milk_type",
  "sweetener",
  "caffeine",
  "special_notes",
  "vendor",
  "status",
] as const;

export type RunnerOrderPatch = Pick<Order, (typeof runnerOrderFields)[number]>;

type PartialRunnerOrderPatch = Partial<RunnerOrderPatch>;
const orderStatuses = new Set([
  "not_asked",
  "confirmed",
  "ordered",
  "picked_up",
  "delivered",
  "no_order",
]);

type ProductionRow = Database["public"]["Tables"]["productions"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type RosterRow = Database["public"]["Tables"]["production_roster"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export class ShareTokenError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

export function hashProductionShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sanitizeRunnerOrderPatch(input: unknown): PartialRunnerOrderPatch {
  if (!input || typeof input !== "object") return {};

  const source = input as Record<string, unknown>;
  const patch: PartialRunnerOrderPatch = {};

  for (const field of runnerOrderFields) {
    if (!(field in source)) continue;
    const value = source[field];
    if (field === "status") {
      if (typeof value === "string" && orderStatuses.has(value)) {
        patch.status = value as Order["status"];
      }
      continue;
    }

    if (value === null || value === undefined) {
      patch[field] = "";
    } else if (typeof value === "string") {
      patch[field] = value;
    }
  }

  return patch;
}

export async function validateProductionShareToken(
  supabase: SupabaseClient<Database>,
  productionId: string,
  token: string,
) {
  const normalizedToken = token.trim();
  if (!productionId || !normalizedToken) {
    throw new ShareTokenError("Missing production share token.", 401);
  }

  const { data, error } = await supabase
    .from("production_share_tokens")
    .select("id, production_id, expires_at, revoked_at")
    .eq("production_id", productionId)
    .eq("token_hash", hashProductionShareToken(normalizedToken))
    .maybeSingle();

  if (error) throw new ShareTokenError(error.message, 500);
  if (!data || data.revoked_at) {
    throw new ShareTokenError("Invalid production share token.", 403);
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    throw new ShareTokenError("Expired production share token.", 403);
  }

  await supabase
    .from("production_share_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}

export function buildRunnerCoffeeData(
  production: ProductionRow,
  client: ClientRow | null,
  people: PersonRow[],
  roster: RosterRow[],
  orders: OrderRow[],
): CoffeeData {
  return {
    clients: client
      ? [
          {
            id: client.id,
            name: client.name,
            notes: "",
            active: client.active,
            created_at: client.created_at,
          },
        ]
      : [],
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      type: person.type,
      role: person.role || "",
      department: person.department || "",
      company: person.company || "",
      photo_url: person.photo_url || "",
      // Operational prompt shown on the runner card/search so drinks can be
      // confirmed quickly; private notes/dietary notes remain omitted below.
      usual_order: person.usual_order || "",
      dietary_notes: "",
      notes: "",
      active: person.active,
      created_at: person.created_at,
    })),
    client_people: [],
    productions: [
      {
        id: production.id,
        name: production.name,
        client_id: production.client_id,
        shoot_date: production.shoot_date || "",
        location: production.location || "",
        runner_name: production.runner_name || "",
        notes: "",
        status: production.status,
        created_at: production.created_at,
      },
    ],
    production_roster: roster.map((item) => ({
      id: item.id,
      production_id: item.production_id,
      person_id: item.person_id,
      group_label: item.group_label || "",
      on_set_today: item.on_set_today,
      sort_order: item.sort_order,
    })),
    orders: orders.map(mapRunnerOrder),
  };
}

export function mapRunnerOrder(row: OrderRow): Order {
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
