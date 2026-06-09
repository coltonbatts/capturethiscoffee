import { ApiError, jsonError, requirePrintStationAccess } from "@/lib/supabase-server";

type CompleteBatchBody = {
  jobs?: unknown;
};

export async function POST(request: Request) {
  try {
    const { supabase } = await requirePrintStationAccess(request);
    const body = (await safeJson(request)) as CompleteBatchBody;
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    const completed = [];

    for (const item of jobs) {
      if (!item || typeof item !== "object") continue;
      const job = item as { id?: unknown; attempt_id?: unknown };
      const id = typeof job.id === "string" ? job.id : "";
      if (!id) continue;

      const { data, error } = await supabase.rpc("complete_label_print_job", {
        p_job_id: id,
        p_attempt_id:
          typeof job.attempt_id === "string" && job.attempt_id.trim()
            ? job.attempt_id.trim()
            : null,
      });

      if (error) throw new ApiError(error.message, 400);
      completed.push(data);
    }

    return Response.json({ jobs: completed });
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
