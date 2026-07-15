import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import type { CoffeeData } from "@/lib/types";
import {
  toOrderLabelContext,
  toProductionBoardDTO,
  toPrinterCoffeeData,
  type OrderLabelContext,
  type OrderLabelSource,
  type ProductionAggregate,
  type ProductionBoardDTO,
  type RunnerClientSource,
  type RunnerOrderSource,
  type RunnerPersonSource,
  type RunnerProductionSource,
  type RunnerRosterSource,
} from "./dto";

type ServerSupabaseClient = SupabaseClient<Database>;

const readableProductionStatuses = new Set(["planning", "active"]);

const productionColumns =
  "id, name, client_id, shoot_date, location, runner_name, status, created_at";
const clientColumns = "id, name, active, created_at";
const personColumns =
  "id, name, type, role, department, company, photo_url, usual_order, active, created_at";
const rosterColumns =
  "id, production_id, person_id, group_label, on_set_today, sort_order";
const orderColumns =
  "id, production_id, roster_id, person_id, drink_type, size, temperature, milk_type, sweetener, caffeine, special_notes, vendor, status, label_printed, created_at, updated_at";

export class ProductionQueryError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function getPrinterProductionData(
  supabase: ServerSupabaseClient,
  productionId: string,
): Promise<CoffeeData> {
  return toPrinterCoffeeData(await getProductionAggregate(supabase, productionId));
}

export async function getProductionBoard(
  supabase: ServerSupabaseClient,
  productionId: string,
): Promise<ProductionBoardDTO> {
  return toProductionBoardDTO(
    await getProductionAggregate(supabase, productionId),
  );
}

export async function getProductionAggregate(
  supabase: ServerSupabaseClient,
  productionId: string,
): Promise<ProductionAggregate> {
  const production = await getReadableProduction(supabase, productionId);

  const [clientResult, rosterResult, ordersResult] = await Promise.all([
    supabase
      .from("clients")
      .select(clientColumns)
      .eq("id", production.client_id)
      .maybeSingle(),
    supabase
      .from("production_roster")
      .select(rosterColumns)
      .eq("production_id", production.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("orders")
      .select(orderColumns)
      .eq("production_id", production.id)
      .order("created_at", { ascending: true }),
  ]);

  throwFirstDatabaseError([
    clientResult.error,
    rosterResult.error,
    ordersResult.error,
  ]);

  const roster = (rosterResult.data || []) as RunnerRosterSource[];
  const personIds = Array.from(new Set(roster.map((item) => item.person_id)));
  const peopleResult = personIds.length
    ? await supabase.from("people").select(personColumns).in("id", personIds)
    : { data: [], error: null };

  throwDatabaseError(peopleResult.error);

  const aggregate: ProductionAggregate = {
    production,
    client: clientResult.data as RunnerClientSource | null,
    people: (peopleResult.data || []) as RunnerPersonSource[],
    roster,
    orders: (ordersResult.data || []) as RunnerOrderSource[],
  };

  return aggregate;
}

export async function getOrderLabelContext(
  supabase: ServerSupabaseClient,
  productionId: string,
  orderId: string,
): Promise<OrderLabelContext | null> {
  const production = await getReadableProduction(supabase, productionId);

  const [clientResult, orderResult] = await Promise.all([
    supabase
      .from("clients")
      .select(clientColumns)
      .eq("id", production.client_id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(orderColumns)
      .eq("id", orderId)
      .eq("production_id", production.id)
      .maybeSingle(),
  ]);

  throwFirstDatabaseError([clientResult.error, orderResult.error]);
  if (!orderResult.data) return null;

  const order = orderResult.data as RunnerOrderSource;
  const rosterResult = await supabase
    .from("production_roster")
    .select(rosterColumns)
    .eq("id", order.roster_id)
    .eq("production_id", production.id)
    .maybeSingle();

  throwDatabaseError(rosterResult.error);
  if (!rosterResult.data) return null;

  const roster = rosterResult.data as RunnerRosterSource;
  const personResult = await supabase
    .from("people")
    .select(personColumns)
    .eq("id", roster.person_id)
    .maybeSingle();

  throwDatabaseError(personResult.error);
  if (!personResult.data) return null;

  const source: OrderLabelSource = {
    production,
    client: clientResult.data as RunnerClientSource | null,
    person: personResult.data as RunnerPersonSource,
    roster,
    order,
  };

  return toOrderLabelContext(source);
}

async function getReadableProduction(
  supabase: ServerSupabaseClient,
  productionId: string,
): Promise<RunnerProductionSource> {
  const { data, error } = await supabase
    .from("productions")
    .select(productionColumns)
    .eq("id", productionId)
    .maybeSingle();

  throwDatabaseError(error);
  if (!data || !readableProductionStatuses.has(data.status)) {
    throw new ProductionQueryError("Production not found.", 404);
  }

  return data as RunnerProductionSource;
}

function throwFirstDatabaseError(errors: Array<{ message: string } | null>) {
  throwDatabaseError(errors.find(Boolean) || null);
}

function throwDatabaseError(error: { message: string } | null) {
  if (error) throw new ProductionQueryError(error.message, 500);
}
