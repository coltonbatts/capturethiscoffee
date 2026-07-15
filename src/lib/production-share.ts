import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase";
import type { Order, ProductionRoster } from "./types";

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
  "label_printed",
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

    if (field === "label_printed") {
      if (typeof value === "boolean") {
        patch.label_printed = value;
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

export function isRunnerOrderOnBoard(
  order: Pick<Order, "production_id" | "roster_id" | "person_id">,
  roster: Pick<
    ProductionRoster,
    "id" | "production_id" | "person_id" | "on_set_today"
  > | null,
  productionId: string,
) {
  return Boolean(
    roster &&
      roster.on_set_today &&
      order.production_id === productionId &&
      roster.production_id === productionId &&
      order.roster_id === roster.id &&
      order.person_id === roster.person_id,
  );
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
