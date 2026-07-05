import type { NextRequest } from "next/server";
import {
  buildRunnerCoffeeData,
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { buildPrinterQueue } from "@/lib/printer-queue";
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
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get("token") || "";
    const supabase = getSupabaseServiceRoleClient();

    await validateProductionShareToken(supabase, id, token);

    const { data: production, error: productionError } = await supabase
      .from("productions")
      .select("*")
      .eq("id", id)
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
    const queue = buildPrinterQueue(data, production.id);
    if (!queue) throw new ApiError("Production not found.", 404);

    return Response.json(queue, {
      headers: {
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
