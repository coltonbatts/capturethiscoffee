import { ensureOrderLabelQueueState } from "@/lib/label-queue";
import { ApiError, jsonError, requireAuthenticatedBearerToken } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requireAuthenticatedBearerToken(request);
    const { id } = await context.params;

    const result = await ensureOrderLabelQueueState(supabase, id, user.id);
    if (!result) throw new ApiError("Could not reconcile label queue.", 400);

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
