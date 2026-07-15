export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { buildPrinterQueue } from "@/lib/printer-queue";
import {
  ApiError,
  getSupabaseServiceRoleClient,
  jsonError,
} from "@/lib/supabase-server";
import {
  getPrinterProductionData,
  ProductionQueryError,
} from "@/server/productions/queries";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get("token") || "";
    const supabase = getSupabaseServiceRoleClient();

    await validateProductionShareToken(supabase, id, token);
    const data = await getPrinterProductionData(supabase, id);
    const queue = buildPrinterQueue(data, id);
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
    if (error instanceof ProductionQueryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return jsonError(error);
  }
}
