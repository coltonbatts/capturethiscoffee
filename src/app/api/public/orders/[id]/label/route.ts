export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { buildCoffeeLabelForOrder } from "@/lib/printer-queue";
import { renderNiimbotM2LabelPngBuffer } from "@/lib/niimbot-m2-export-server";
import {
  ApiError,
  getSupabaseServiceRoleClient,
  jsonError,
} from "@/lib/supabase-server";
import {
  getOrderLabelContext,
  ProductionQueryError,
} from "@/server/productions/queries";

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
    const labelContext = await getOrderLabelContext(supabase, productionId, orderId);
    const label = labelContext ? buildCoffeeLabelForOrder(labelContext) : null;
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
    if (error instanceof ProductionQueryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return jsonError(error);
  }
}
