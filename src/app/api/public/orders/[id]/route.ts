import type { NextRequest } from "next/server";
import {
  isRunnerOrderOnBoard,
  sanitizeRunnerOrderPatch,
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import {
  ApiError,
  getSupabaseServiceRoleClient,
  jsonError,
} from "@/lib/supabase-server";
import {
  enforcePublicApiRateLimit,
  readLimitedJsonRequest,
} from "@/lib/public-api-guard";
import { toRunnerOrder } from "@/server/productions/dto";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    enforcePublicApiRateLimit({ request, scope: "runner-order-patch" });
    const body = (await readLimitedJsonRequest(request)) as {
      productionId?: unknown;
      token?: unknown;
      patch?: unknown;
    } | null;
    const productionId =
      typeof body?.productionId === "string" ? body.productionId : "";
    const token = typeof body?.token === "string" ? body.token : "";
    const patch = sanitizeRunnerOrderPatch(body?.patch);

    if (!Object.keys(patch).length) {
      throw new ApiError("No allowed order fields were provided.", 400);
    }

    const supabase = getSupabaseServiceRoleClient();
    await validateProductionShareToken(supabase, productionId, token);

    const [productionResult, orderResult] = await Promise.all([
      supabase
        .from("productions")
        .select("id, status")
        .eq("id", productionId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, production_id, roster_id, person_id")
        .eq("id", id)
        .eq("production_id", productionId)
        .maybeSingle(),
    ]);

    if (productionResult.error) {
      throw new ApiError(productionResult.error.message, 500);
    }
    if (orderResult.error) throw new ApiError(orderResult.error.message, 500);
    const production = productionResult.data;
    const order = orderResult.data;
    if (!production || production.status !== "active") {
      throw new ApiError("Production is not active.", 403);
    }
    if (!order) throw new ApiError("Order not found.", 404);

    const { data: roster, error: rosterError } = await supabase
      .from("production_roster")
      .select("id, production_id, person_id, on_set_today")
      .eq("id", order.roster_id)
      .maybeSingle();

    if (rosterError) throw new ApiError(rosterError.message, 500);
    if (!isRunnerOrderOnBoard(order, roster, productionId)) {
      throw new ApiError("Order not found.", 404);
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("production_id", productionId)
      .eq("roster_id", order.roster_id)
      .eq("person_id", order.person_id)
      .select("*")
      .maybeSingle();

    if (error) throw new ApiError(error.message, 500);
    if (!data) throw new ApiError("Order not found.", 404);

    return Response.json({ order: toRunnerOrder(data) });
  } catch (error) {
    if (error instanceof ShareTokenError) {
      return jsonError(error);
    }
    return jsonError(error);
  }
}
