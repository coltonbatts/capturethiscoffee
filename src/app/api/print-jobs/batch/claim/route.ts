import {
  ApiError,
  jsonError,
  parsePositiveInteger,
  requirePrintStationAccess,
} from "@/lib/supabase-server";

type ClaimBatchBody = {
  job_ids?: unknown;
  limit?: unknown;
};

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requirePrintStationAccess(request);
    const body = (await safeJson(request)) as ClaimBatchBody;
    const requestedIds = Array.isArray(body.job_ids)
      ? body.job_ids.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [];
    const limit = parsePositiveInteger(body.limit, 100, 200);

    let queuedQuery = supabase
      .from("label_print_jobs")
      .select("id")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (requestedIds.length) queuedQuery = queuedQuery.in("id", requestedIds);

    const { data: queued, error: queuedError } = await queuedQuery;
    if (queuedError) throw new ApiError(queuedError.message, 400);

    const ids = (queued || []).map((job) => job.id);
    if (!ids.length) return Response.json({ jobs: [] });

    const { data, error } = await supabase
      .from("label_print_jobs")
      .update({
        status: "claimed",
        assigned_to: user.id,
        claimed_at: new Date().toISOString(),
        error_message: null,
      })
      .in("id", ids)
      .eq("status", "queued")
      .select("*, label_print_attempts(*)");

    if (error) throw new ApiError(error.message, 400);

    return Response.json({ jobs: data || [] });
  } catch (error) {
    return jsonError(error);
  }
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
