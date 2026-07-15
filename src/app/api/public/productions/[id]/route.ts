export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { getSupabaseServiceRoleClient, jsonError } from "@/lib/supabase-server";
import {
  getRunnerProductionData,
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
    const data = await getRunnerProductionData(supabase, id);

    return Response.json({ data });
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
