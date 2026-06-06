import { ApiError, jsonError, requireAuthenticatedBearerToken } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireAuthenticatedBearerToken(request);
    const { id } = await context.params;
    const body = await safeJson(request);

    const { data, error } = await supabase.rpc("complete_label_print_job", {
      p_job_id: id,
      p_attempt_id: stringOrNull(body.attempt_id),
    });

    if (error) throw new ApiError(error.message, 400);

    return Response.json({ job: data });
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

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
