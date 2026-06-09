import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCoffeeLabels,
  defaultLabelOptions,
  type CoffeeLabel,
} from "./label-copy";
import { buildLabelPrintJobPayload } from "./print-jobs";
import type { Database } from "./supabase";
import type {
  Client,
  Order,
  Person,
  Production,
  ProductionRoster,
  RosterOrder,
} from "./types";

type QueueAction = "created" | "updated" | "cancelled" | "unchanged";
type PrintJobRow = Database["public"]["Tables"]["label_print_jobs"]["Row"];
type ActiveStatus = "queued" | "claimed" | "printing";
type LabelQueueItem = RosterOrder & {
  production: Production;
  client?: Client;
  order: Order;
};

const activeStatuses: ActiveStatus[] = ["queued", "claimed", "printing"];
const printableStatuses = new Set<Order["status"]>(["confirmed", "ordered"]);
const postPrintStatuses = new Set<Order["status"]>(["picked_up", "delivered"]);

export type EnsureOrderLabelQueueResult = {
  action: QueueAction;
  job: PrintJobRow | null;
  cancelled_jobs: string[];
};

export async function ensureOrderLabelQueueState(
  supabase: SupabaseClient<Database>,
  orderId: string,
  userId: string,
): Promise<EnsureOrderLabelQueueResult> {
  const item = await loadRosterOrderForLabel(supabase, orderId);
  const activeJobs = await loadActiveJobs(supabase, orderId);

  if (!item || item.order.status === "no_order" || item.order.status === "not_asked") {
    const cancelled = await cancelActiveJobs(supabase, activeJobs);
    return { action: cancelled.length ? "cancelled" : "unchanged", job: null, cancelled_jobs: cancelled };
  }

  const shouldQueue =
    printableStatuses.has(item.order.status) ||
    (postPrintStatuses.has(item.order.status) &&
      item.order.label_printed &&
      (await printedPayloadDiffers(supabase, item.order.id, item)));

  if (!shouldQueue) {
    return { action: "unchanged", job: activeJobs[0] || null, cancelled_jobs: [] };
  }

  const payload = buildPayload(item);
  const [primaryJob, ...duplicates] = activeJobs;
  const cancelled = await cancelActiveJobs(supabase, duplicates);

  if (primaryJob) {
    const { data, error } = await supabase
      .from("label_print_jobs")
      .update({
        production_id: item.order.production_id,
        order_id: item.order.id,
        person_id: item.order.person_id,
        payload,
        printer_family: payload.printer_family,
        copies: 1,
        error_message: null,
      })
      .eq("id", primaryJob.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { action: "updated", job: data, cancelled_jobs: cancelled };
  }

  const { data, error } = await supabase
    .from("label_print_jobs")
    .insert({
      production_id: item.order.production_id,
      order_id: item.order.id,
      person_id: item.order.person_id,
      created_by: userId,
      priority: 0,
      payload,
      printer_family: payload.printer_family,
      copies: 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { action: "created", job: data, cancelled_jobs: cancelled };
}

async function loadRosterOrderForLabel(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<LabelQueueItem | null> {
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError) throw new Error(orderError.message);
  if (!orderRow) return null;

  const [productionResult, rosterResult, personResult] = await Promise.all([
    supabase.from("productions").select("*").eq("id", orderRow.production_id).single(),
    supabase.from("production_roster").select("*").eq("id", orderRow.roster_id).single(),
    supabase.from("people").select("*").eq("id", orderRow.person_id).single(),
  ]);

  if (productionResult.error) throw new Error(productionResult.error.message);
  if (rosterResult.error) throw new Error(rosterResult.error.message);
  if (personResult.error) throw new Error(personResult.error.message);

  const production = productionResult.data as Production;
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", production.client_id)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);

  return {
    production,
    client: (clientRow as Client | null) || undefined,
    roster: rosterResult.data as ProductionRoster,
    person: personResult.data as Person,
    order: orderRow as Order,
  };
}

async function loadActiveJobs(
  supabase: SupabaseClient<Database>,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("label_print_jobs")
    .select("*")
    .eq("order_id", orderId)
    .in("status", activeStatuses)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

async function cancelActiveJobs(
  supabase: SupabaseClient<Database>,
  jobs: PrintJobRow[],
) {
  const ids = jobs.map((job) => job.id);
  if (!ids.length) return [];

  const { error } = await supabase
    .from("label_print_jobs")
    .update({
      status: "cancelled",
      assigned_to: null,
      error_message: "Cancelled by label queue reconciliation.",
    })
    .in("id", ids);

  if (error) throw new Error(error.message);
  return ids;
}

async function printedPayloadDiffers(
  supabase: SupabaseClient<Database>,
  orderId: string,
  item: LabelQueueItem,
) {
  const { data, error } = await supabase
    .from("label_print_jobs")
    .select("payload")
    .eq("order_id", orderId)
    .eq("status", "printed")
    .order("printed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  return JSON.stringify(data.payload) !== JSON.stringify(buildPayload(item));
}

function buildPayload(item: LabelQueueItem) {
  const label = buildLabel(item);
  return buildLabelPrintJobPayload({
    productionId: item.order.production_id,
    orderId: item.order.id,
    personId: item.order.person_id,
    label,
    options: defaultLabelOptions,
  });
}

function buildLabel(item: LabelQueueItem): CoffeeLabel {
  const [label] = buildCoffeeLabels(
    item.production,
    item.client,
    [item],
    defaultLabelOptions,
  );
  if (!label) throw new Error("Order is not label-ready.");
  return label;
}
