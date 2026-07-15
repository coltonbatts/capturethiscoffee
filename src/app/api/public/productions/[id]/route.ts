export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import {
  ShareTokenError,
  validateProductionShareToken,
} from "@/lib/production-share";
import { enforcePublicApiRateLimit } from "@/lib/public-api-guard";
import { getSupabaseServiceRoleClient, jsonError } from "@/lib/supabase-server";
import {
  getProductionBoard,
  ProductionQueryError,
} from "@/server/productions/queries";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get("token") || "";
    enforcePublicApiRateLimit({ request, scope: "runner-production", token });
    const supabase = getSupabaseServiceRoleClient();

    await validateProductionShareToken(supabase, id, token);
    const data = await getProductionBoard(supabase, id);

    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ShareTokenError) {
      return jsonError(error);
    }
    if (error instanceof ProductionQueryError) {
      return jsonError(error);
    }
    return jsonError(error);
  }
}
