import "server-only";

import { formatDrink } from "@/lib/order-summary";
import type { OrderPatch, SaveOrderOptions } from "@/lib/operator-inputs";
import type { Order } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  requireOperatorRow,
  throwOperatorDatabaseError,
} from "./errors";
import { mapOrder } from "./mappers";
import {
  normalizeOrderPatch,
  nullableText,
  requireId,
} from "./validation";

export async function updateOrder(
  orderId: string,
  input: OrderPatch,
): Promise<Order> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(orderId, "Order ID");
  const patch = normalizeOrderPatch(input);
  const { data, error } = await supabase
    .from("orders")
    .update(toOrderWrite(patch))
    .eq("id", id)
    .select("*")
    .maybeSingle();

  throwOperatorDatabaseError(error, "Could not update order.");
  if (!data) throw new OperatorDataError("Order not found.", "not_found");
  return mapOrder(data);
}

export async function saveOrderDraft(
  orderId: string,
  input: OrderPatch,
  options: SaveOrderOptions = {},
): Promise<{ order: Order; usualOrderPersonId?: string; usualOrder?: string }> {
  const { supabase } = await requireOperatorContext();
  const id = requireId(orderId, "Order ID");
  const existingResult = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOperatorDatabaseError(existingResult.error, "Could not load order.");
  if (!existingResult.data) {
    throw new OperatorDataError("Order not found.", "not_found");
  }

  const current = mapOrder(existingResult.data);
  const patch = normalizeOrderPatch(input);
  const next = {
    ...current,
    ...patch,
    status: patch.status || "confirmed",
  } satisfies Order;
  const orderResult = await supabase
    .from("orders")
    .update(toOrderWrite(next))
    .eq("id", id)
    .select("*")
    .single();
  throwOperatorDatabaseError(orderResult.error, "Could not save order.");

  const usualOrder = formatDrink(next);
  if (options.updateUsualOrder && usualOrder !== "No order") {
    const personResult = await supabase
      .from("people")
      .update({ usual_order: usualOrder })
      .eq("id", current.person_id);
    throwOperatorDatabaseError(personResult.error, "Could not update usual order.");
    return {
      order: mapOrder(requireOperatorRow(orderResult.data, "Could not save order.")),
      usualOrderPersonId: current.person_id,
      usualOrder,
    };
  }

  return {
    order: mapOrder(requireOperatorRow(orderResult.data, "Could not save order.")),
  };
}

function toOrderWrite(order: OrderPatch) {
  return {
    drink_type:
      order.drink_type === undefined ? undefined : nullableText(order.drink_type, 500),
    size: order.size === undefined ? undefined : nullableText(order.size, 500),
    temperature:
      order.temperature === undefined
        ? undefined
        : nullableText(order.temperature, 500),
    milk_type:
      order.milk_type === undefined ? undefined : nullableText(order.milk_type, 500),
    sweetener:
      order.sweetener === undefined ? undefined : nullableText(order.sweetener, 500),
    caffeine:
      order.caffeine === undefined ? undefined : nullableText(order.caffeine, 500),
    special_notes:
      order.special_notes === undefined
        ? undefined
        : nullableText(order.special_notes, 500),
    vendor:
      order.vendor === undefined ? undefined : nullableText(order.vendor, 500),
    status: order.status,
    label_printed: order.label_printed,
    updated_at: new Date().toISOString(),
  };
}
