import { ApiError, jsonError, requireAuthenticatedBearerToken } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireAuthenticatedBearerToken(request);
    const { id } = await context.params;
    const body = await request.json();
    const release = body.release === true;
    const errorMessage = stringOrNull(body.error_message);

    const patch = release
      ? {
          status: "queued" as const,
          assigned_to: null,
          claimed_at: null,
          error_message: errorMessage,
        }
      : {
          status: "failed" as const,
          error_message: errorMessage || "Print failed.",
        };

    const { data, error } = await supabase
      .from("label_print_jobs")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new ApiError(error.message, 400);

    const attemptId = stringOrNull(body.attempt_id);
    if (attemptId) {
      const { error: attemptError } = await supabase
        .from("label_print_attempts")
        .update({
          status: release ? "cancelled" : "failed",
          finished_at: new Date().toISOString(),
          error_message: errorMessage || (release ? "Skipped." : "Print failed."),
        })
        .eq("id", attemptId)
        .eq("job_id", id);

      if (attemptError) throw new ApiError(attemptError.message, 400);
    }

    return Response.json({ job: data });
  } catch (error) {
    return jsonError(error);
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
