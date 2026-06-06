import { ApiError, jsonError, parsePositiveInteger, requireAuthenticatedBearerToken } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireAuthenticatedBearerToken(request);
    const { id } = await context.params;
    const limit = parsePositiveInteger(
      new URL(request.url).searchParams.get("limit"),
      100,
      200,
    );

    const [ordersResult, jobsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("production_id", id)
        .order("created_at", { ascending: true })
        .limit(limit),
      supabase
        .from("label_print_jobs")
        .select("*, label_print_attempts(*)")
        .eq("production_id", id)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (ordersResult.error) throw new ApiError(ordersResult.error.message, 400);
    if (jobsResult.error) throw new ApiError(jobsResult.error.message, 400);

    return Response.json({
      production_id: id,
      orders: ordersResult.data || [],
      jobs: jobsResult.data || [],
    });
  } catch (error) {
    return jsonError(error);
  }
}
