import type { NextRequest } from "next/server";
import {
  mapRunnerOrder,
  sanitizeRunnerOrderPatch,
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import {
  ApiError,
  getSupabaseServiceRoleClient,
  jsonError,
} from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
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

    const { data: production, error: productionError } = await supabase
      .from("productions")
      .select("id, status")
      .eq("id", productionId)
      .maybeSingle();

    if (productionError) throw new ApiError(productionError.message, 500);
    if (!production || production.status !== "active") {
      throw new ApiError("Production is not active.", 403);
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("production_id", productionId)
      .select("*")
      .maybeSingle();

    if (error) throw new ApiError(error.message, 500);
    if (!data) throw new ApiError("Order not found.", 404);

    return Response.json({ order: mapRunnerOrder(data) });
  } catch (error) {
    if (error instanceof ShareTokenError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return jsonError(error);
  }
}
