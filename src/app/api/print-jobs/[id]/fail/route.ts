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

    const patch = release
      ? {
          status: "queued" as const,
          assigned_to: null,
          claimed_at: null,
          error_message: stringOrNull(body.error_message),
        }
      : {
          status: "failed" as const,
          error_message: stringOrNull(body.error_message) || "Print failed.",
        };

    const { data, error } = await supabase
      .from("label_print_jobs")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new ApiError(error.message, 400);

    return Response.json({ job: data });
  } catch (error) {
    return jsonError(error);
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
