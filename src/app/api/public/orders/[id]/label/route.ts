export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  buildRunnerCoffeeData,
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { findCoffeeLabelForOrder } from "@/lib/printer-queue";
import { renderNiimbotM2LabelPngBuffer } from "@/lib/niimbot-m2-export-server";
import {
  ApiError,
  getSupabaseServiceRoleClient,
  jsonError,
} from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await context.params;
    const productionId = request.nextUrl.searchParams.get("productionId") || "";
    const token = request.nextUrl.searchParams.get("token") || "";
    // The legacy "design" query param is accepted but ignored: there is one label design.

    if (!productionId) {
      throw new ApiError("Missing productionId.", 400);
    }

    const supabase = getSupabaseServiceRoleClient();
    await validateProductionShareToken(supabase, productionId, token);

    const { data: production, error: productionError } = await supabase
      .from("productions")
      .select("*")
      .eq("id", productionId)
      .maybeSingle();

    if (productionError) throw new ApiError(productionError.message, 500);
    if (!production || !["planning", "active"].includes(production.status)) {
      throw new ApiError("Production not found.", 404);
    }

    const [clientResult, rosterResult, ordersResult] = await Promise.all([
      supabase.from("clients").select("*").eq("id", production.client_id).maybeSingle(),
      supabase
        .from("production_roster")
        .select("*")
        .eq("production_id", production.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("orders")
        .select("*")
        .eq("production_id", production.id)
        .order("created_at", { ascending: true }),
    ]);

    const firstError = [clientResult.error, rosterResult.error, ordersResult.error].find(
      Boolean,
    );
    if (firstError) throw new ApiError(firstError.message, 500);

    const roster = rosterResult.data || [];
    const personIds = Array.from(new Set(roster.map((item) => item.person_id)));
    const peopleResult = personIds.length
      ? await supabase.from("people").select("*").in("id", personIds)
      : { data: [], error: null };

    if (peopleResult.error) throw new ApiError(peopleResult.error.message, 500);

    const data = buildRunnerCoffeeData(
      production,
      clientResult.data,
      peopleResult.data || [],
      roster,
      ordersResult.data || [],
    );
    const label = findCoffeeLabelForOrder(data, productionId, orderId);
    if (!label) throw new ApiError("Label not found for this order.", 404);

    const png = await renderNiimbotM2LabelPngBuffer(label);

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ShareTokenError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return jsonError(error);
  }
}
