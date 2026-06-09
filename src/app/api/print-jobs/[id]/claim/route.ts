import { ApiError, jsonError, requirePrintStationAccess } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await requirePrintStationAccess(request);
    const { id } = await context.params;

    const { data, error } = await supabase
      .from("label_print_jobs")
      .update({
        status: "claimed",
        assigned_to: user.id,
        claimed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (error) throw new ApiError(error.message, 400);
    if (!data) throw new ApiError("Print job is not queued.", 409);

    return Response.json({ job: data });
  } catch (error) {
    return jsonError(error);
  }
}
